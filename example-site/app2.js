const Push = require('../push.js'),
    foreach = require('lodash.foreach'),
    partial = require('lodash.partial'),
    Player = require('./player.js'),
    context = new AudioContext(),
    Repetae = require('./repetae.js'),
    samples = [
        'samples/Bonus_Kick27.mp3',
        'samples/snare_ac2_r1.mp3',
        'samples/HandClap.mp3',
        'samples/Beat07_Hat.mp3',
        'samples/HH_KIT09_100_TMB.mp3',
        'samples/clingfilm.mp3',
        'samples/tang-1.mp3',
        'samples/Cassette808_Tom01.mp3'
    ],
    repeat_interval_buttons = [
        { name: '1/32t', amount: 50 },
        { name: '1/32', amount: 100 },
        { name: '1/16t', amount: 150 },
        { name: '1/16', amount: 200 },
        { name: '1/8t', amount: 250 },
        { name: '1/8', amount: 300 },
        { name: '1/4t', amount: 350 },
        { name: '1/4', amount: 400 },
    ];

window.addEventListener('load', () => {
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true })
            .then(Push.create_bound_to_web_midi_api)
            .then(off_we_go)
            .catch(function(error) { console.log(error.message) });
    } else {
        alert('No MIDI support in your browser');
    }
});

function off_we_go(bound_push) {
    const buttons = document.getElementsByClassName('button'),
        players = create_players(),
        push = bound_push;

    foreach(players, (player, i) => {
        var column_number = i + 1,
            full_path_sample_name = samples[i].split('.')[0],
            sample_name = full_path_sample_name.split('/').pop(),
            repetae = Repetae.create_scheduled_by_audio_context(context);

        push.grid.select[column_number].on('pressed', repetae.press);
        push.grid.select[column_number].on('released', repetae.release);

        push.grid.select[column_number].led_on();
        repetae.on('on', partial(push.grid.select[column_number].led_rgb, 0, 0, 255));
        repetae.on('off', push.grid.select[column_number].led_on);
        repetae.on('interval', push.lcd.x[column_number].y[1].update);
        repetae.report_interval();

        foreach(repeat_interval_buttons, (button) => {
            push.control[button.name].on('pressed', partial(repetae.interval, button.amount))
        });

        turn_off_column(push, column_number);
        push.lcd.x[column_number].y[2].update(sample_name.length > 8 ? sample_name.substr(sample_name.length - 8) : sample_name);
        player.on('started', partial(turn_button_display_on, buttons[i]));
        player.on('stopped', partial(turn_button_display_off, buttons[i]));
        player.on('started', partial(turn_on_column, push, column_number));
        player.on('stopped', partial(turn_off_column, push, column_number));
        buttons[i].addEventListener('mousedown', partial(player.play, 110));
        bind_column_to_player(push, player, column_number, repetae);
    });

    foreach(repeat_interval_buttons, (button) => {
        push.control[button.name].led_dim();
    });

    bind_pitchbend(push, players);
}

function create_players() {
    var players = [];
    for (var  i = 0; i < samples.length; i++) {
        players[i] = new Player(samples[i], context);
    }
    return players;
}

function bind_column_to_player(push, player, x, repetae) {
    foreach([1, 2, 3, 4, 5, 6, 7, 8], (y) => {
        var grid_button = push.grid.y[y].x[x];
        grid_button.on('pressed', (velocity) => {
            repetae.start(partial(player.play, velocity))
        });
        grid_button.on('released', repetae.stop);
    });
}

function turn_on_column(push, x, velocity) {
    foreach([1, 2, 3, 4, 5, 6, 7, 8], (y) => {
        if (((velocity + 15) / 16) >= y) {
            push.grid.x[x].y[y].led_on(velocity);
        } else {
            push.grid.x[x].y[y].led_off();
        }
    });
}

function turn_off_column(push, x) {
    foreach([2, 3, 4, 5, 6, 7, 8], (y) => {
        push.grid.y[y].x[x].led_off();
    });
    push.grid.y[1].x[x].led_on();
}

function bind_pitchbend(push, players) {
    push.touchstrip.on('pitchbend', (pb) => {
        var rate = pb > 8192 ? pb / 4096 : pb / 8192;
        foreach(players, (player) => player.update_playback_rate(rate));
    });
}

function turn_button_display_on(ui_btn) {
    ui_btn.classList.add('active');
}

function turn_button_display_off(ui_btn) {
    ui_btn.classList.remove('active');
}