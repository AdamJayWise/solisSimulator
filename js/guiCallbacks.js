// accumulations callback
var accumButton = d3.select('#numAccumulations');
accumButton.on('change', function(){
    app['numAccumulations'] = Math.round(Number(this.value));
});

// exposureTime callback
var accumButton = d3.select('#exposureTime');
accumButton.on('change', function(){
    app['exposureTime'] = Number(this.value);
    console.log('ting')
});
