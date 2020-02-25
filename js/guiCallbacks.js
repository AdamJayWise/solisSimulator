// accumulations callback
var accumButton = d3.select('#numAccumulations');
accumButton.on('change', function(){
    app['numAccumulations'] = Math.round(Number(this.value));
});

// em gain input callback
var emGainInput = d3.select('#emGain');
emGainInput.on('change', function(){
    var newVal = Number(this.value) | 2;
    newVal = Math.min(300,newVal);
    newVal = Math.max(2, newVal);
    this.value = newVal;
    cameras[0].emGain = newVal;
})

// exposureTime callback
var accumButton = d3.select('#exposureTime');
accumButton.on('change', function(){
    app['exposureTime'] = Number(this.value);
    console.log('ting')
});

// readout rate callback
var readOutSelect = d3.select('#readOut');
readOutSelect.on('change', function(){
    app['readOutRate'] = Number(this.value.split('-')[1]);
    cameras[0].readNoise = cameras[0].readNoises[this.value];
});

// amplfier choice callback - change the choices available at the readout rate option
var amp = d3.selectAll('input[name=amp]');
amp.on('change', function(){
    console.log(this.value)
    if (this.value == 'conventional'){
        readOutSelect.selectAll('option').remove();
        var convOptionConfig = [{'value':'conv-0.08','text':'80kHz at 16 Bit'},
                            {'value':'conv-1','text':'1MHz at 16 Bit'},
                            {'value':'conv-1','text':'1MHz at 16 Bit'}];
        convOptionConfig.forEach(function(op){
            readOutSelect.append('option').attr('value',op['value']).text(op['text'])
        });
        cameras[0].readNoise = cameras[0].readNoises[convOptionConfig[0]['value']];
        cameras[0].amplifier = 'conventional';
    }
    if (this.value == 'em'){
        readOutSelect.selectAll('option').remove();
        var convOptionConfig = [{'value':'em-1','text':'1MHz at 16 Bit'},
                                {'value':'em-5','text':'5MHz at 16 Bit'},
                                {'value':'em-10','text':'10MHz at 16 Bit'},
                                {'value':'em-17','text':'17MHz at 16 Bit'}];
        convOptionConfig.forEach(function(op){
            readOutSelect.append('option').attr('value',op['value']).text(op['text'])
        });
        cameras[0].readNoise = cameras[0].readNoises[convOptionConfig[0]['value']];
        cameras[0].amplifier = 'em';
    }
});

