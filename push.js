// Public API/node-module for the Push

const EventEmitter = require('events'),
    util = require('util'),
    Buttons = require('./src/buttons.js'),
    Knobs = require('./src/knobs'),
    Grid = require('./src/grid.js'),
    Touchstrip = require('./src/touchstrip.js'),
    ControlPads = require('./src/control-pads.js');

function Push(midi_out) {
    EventEmitter.call(this);
    this.output_port = midi_out;
    this.buttons = new Buttons(midi_out);
    this.knobs = new Knobs();
    this.grid = new Grid(midi_out);
    this.touchstrip = new Touchstrip();
    this.control = new ControlPads(midi_out);
}
util.inherits(Push, EventEmitter);

function handle_midi_cc(push, index, value) {
    var module;

    switch (true) {
        case ((index == 14) || (index == 15) || ((index >= 71) && (index <= 79))):
            module = push.knobs;
            break;
        case (((20 <= index) && (index <= 27)) || ((102 <= index) && (index <= 109))):
            module = push.control;
            break
        case (push.buttons.handles_cc(index)):
            module = push.buttons;
            break;
        default:
            console.log('No known mapping for CC: ' + index);
            return;
    }

    module.receive_midi_cc(index, value);
} 

function handle_midi_note(push, note, velocity) {
    var module = note < 12 ? push.knobs : push.grid;
    if (note == 12) module = push.touchstrip;
    module.receive_midi_note(note, velocity);
}

function handle_midi_pitch_bend(push, lsb_byte, msb_byte) {
    push.touchstrip.receive_midi_pitch_bend((msb_byte << 7) + lsb_byte);
}

var midi_messages = {
    'note-off': 128, // note number, velocity
    'note-on': 144, // note number, velocity
    'poly-pressure': 160, // note number, velocity
    'cc': 176, // cc number, value
    'program-change': 192, // pgm number
    'channel-pressure': 208, // velocity
    'pitch-bend': 224, // lsb (7-bits), msb (7-bits)
    'sysex': 240, // id [1 or 3 bytes], data [n bytes], 247
}

// Handles MIDI (CC) data from Push - causes events to be emitted
Push.prototype.receive_midi = function(bytes) {
    // console.log(bytes);
    var message_type = bytes[0] & 0xf0;
    var midi_channel = bytes[0] & 0x0f;

    switch (message_type) {
        case (midi_messages['cc']):
            handle_midi_cc(this, bytes[1], bytes[2]);
            break;
        case (midi_messages['note-on']):
        case (midi_messages['note-off']):
            handle_midi_note(this, bytes[1], bytes[2]);
            break;
        case (midi_messages['pitch-bend']):
            handle_midi_pitch_bend(this, bytes[1], bytes[2]);
            break;
    }
}

// Adaptor function used to bind to web MIDI API
Push.create_bound_to_web_midi_api = function(midiAccess) {
    var inputs = midiAccess.inputs.values(),
        outputs = midiAccess.outputs.values(),
        push;

    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        console.log('Found output: ' + output.value.name);
        if ('Ableton Push User Port' == output.value.name) {
            console.log('Binding MIDI output to ' + output.value.name);
            push = new Push(output.value);
            break;
        }
    }

    if (push === undefined) push = new Push({ send: (bytes) => { 'no implementation by default' } });

    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        console.log('Found input: ' + input.value.name);
        if ('Ableton Push User Port' == input.value.name) {
            console.log('Binding MIDI input to ' + input.value.name);
            input.value.onmidimessage = (event) => { push.receive_midi(event.data) };
            break;
        }
    }

    return push;
}

module.exports = Push;