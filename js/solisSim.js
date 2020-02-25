console.log('videoSim.js - Adam Wise 2019')

// global variables, I love them
var objPos = [0,0]; // x,y position of the feature in pixels

var speedMultiplier = 0.5; // fudge factor for random walk speed of the feature

var app = {
 'mode' : 'Fast', // fast or slow imaging mode
 'exposureTime' : 0.1, // exposure time in seconds
 'numAccumulations' : 1, // number of accumulations
 'wavelength' : 500, // wavelength of light incident on camera, in nm
 'featureBrightness' : 10, // peak brightness of the feature in photons / counts / whatever
 'activeDataSet' : 0, // which data set is currently active
 'cycleTime' : 0.1, // seconds per frame
'readOutRate' : 0.08 //readout rate in MHz
}
// overall idea...
// I want one or more camera objects, each one has an image object which it displays
// the camera has a height and width, and controls
// let me start by creating a way to display the image, and show an animated image of a
// HxW screen with poisson sampling

// ok now for the next feature - a switch that will change between "fast imaging", and "long exposures"
// the "fast imaging" mode will give a qualitative idea for real-time imaging
// the "slow imaging / long exposure" mode will give 
// maybe a spectra mode as well, which uses a set height and calculates the spectrum

// ok - now, how to add a changeable 'resolution'

// Knuth low-lambda Poisson random sample generator
function poissonSample( lambda = 1, numSamples = 1 ){
    var output = []

    // if lambda = 0, return array of zeros
    if (lambda <= 0 || isNaN(lambda)){
        output.length = numSamples;
        output.fill(0)
        return output
    }

    var l = Math.exp(-lambda);
    var k = 0;
    var p = 1;
    for (var i = 0; i < numSamples; i++){
        k = 0;
        p = 1;
        while(p>l){
            k++;
            p = p*Math.random();
        }
        output.push( Math.max(k-1,0));
    }
    return output;
}


function generateRandomArray(m,n){
    var m = new Arr2d(m,n,0).mapData(d=>poissonSample(4));
    return m
}

// Standard Normal variate using Box-Muller transform.
function randBM() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

// helper function to make arrays of normally distributed random values
function randnSample(nSamples = 1, mu = 0, sigma = 10) {
    var output = [];
    output.length = nSamples;
    for (i = 0; i < nSamples; i++){
        output[i] = (randBM() * sigma) + mu;
    }
    return output;
}

// helper function to add two arrays assuming numbers inside and equal length
function arraySum(x,y){
    var output = []
    output.length = x.length;
    for(i=0; i<x.length; i++){
        output[i] = x[i] + y[i]
    }
    return output
}

function Camera(paramObj){
    var self = this;
    
    //default parameters
    console.log('setting parameters');
    self.name = 'Generic Camera'
    self.xPixels = 64; // number of pixels in x dimension
    self.yPixels = 64; // number of pixels in y dimension
    self.xPixelSize = 13; // x pixel size in microns
    self.yPixelSize = 13; // y pixel size in microns
    
    self.readNoise = 2; // rms read noise in electrons
    self.readNoiseSlow = 1; // rms read noise for slow readout
    self.readNoiseFast = 3; // rms read noise for slowest readout
    
    self.CIC = 0; // CIC in events / pixel / frame
    self.offset = 0; // offset in counts for the fake ADC
    self.featureSigma = 10; // FWHM of image feature
    self.QE = 1; // camera quantum efficiency (QE), range from 0 to 1
    
    self.frameRateHz = 10; // camera framerate in relative units
    self.frameRateHzFast = 20; // camera framerate for fast mode
    self.frameRateHzSlow = 5; // camera framerate for slow mode

    self.darkCurrent = 0.001; // camera dark current in e/pix/sec
    self.emGain = 0; // em gain flag
    self.model = models['BV']; // what chip variant is this camera using

    self.pixelDecimation = 1; // factor to reduce resolution to ease display on a monitor
    self.hasRealImage = true; // should this camera have another real image available?

    self.amplifier = 'conventional'; // is the camera using conventional or em amplifier

    if (paramObj){
        self.div = d3.select('#' + paramObj.containerDivID).append('div').attr('class','cameraDiv');
    }
    else {
        self.div = d3.select('body').append('div').attr('class','cameraDiv');
    }


    if (paramObj){
        Object.keys(paramObj).forEach(function(k){self[k]=paramObj[k]})
    }
    
    self.xPixels = Math.round(self.xPixels / self.pixelDecimation);
    self.yPixels = Math.round(self.yPixels / self.pixelDecimation)
    
    // add a canvas to the document to display this data
    var displayScaleFactor = 0.9;

    self.div.style('position', 'fixed')
                    .style('top','0')
                    .style('left','580')
    self.canvas  = self.div
                    .append('div')
                    .attr('class','canvasHolder')
                    .style('border','3 px solid black')
                    .style('padding-top',  0.5 * self.yPixels * (displayScaleFactor - 1) + 'px')
                    .style('padding-bottom',  0.5 * self.yPixels * (displayScaleFactor - 1) + 'px')
                    .style('width', self.yPixels * displayScaleFactor + 'px')
                    .append('canvas')
                    .attr('width', self.xPixels + ' px')
                    .attr('height', self.yPixels + ' px')
                    .style('transform','scale(' + displayScaleFactor + ')')
                    .style('transform-origin','center left')


                    
                    // so original height is yPixels, new width is yPixels * displayScaleFactor
                    // so top/bottom margin of 1/2 of the difference (ypixels*displayScaleFactor - ypixels)
                    // or 0.5 * yPixels * (displayScaleFactor - 1)

                    
    function startDrag(){
        var thisDiv = d3.select(this)
        thisDiv.style('position','fixed')       
    }

    function dragging(){
        var currentTop = Number(d3.select(this).style('top').slice(0,-2))
        var currentLeft = Number(d3.select(this).style('left').slice(0,-2))
        d3.select(this).style('left', currentLeft + d3.event.dx + 'px')
        d3.select(this).style('top',currentTop + d3.event.dy + 'px')
    }

    self.div.call(d3.drag().on("start", startDrag).on('drag',dragging));


    var labelContainer = self.div.append('div').attr('class','labelContainer')
    
    labelContainer.append('span')
        .style('margin','0')
        .html(self.displayName)
        .attr('class','windowLabel')
        .attr('class','nameLabel')
    
    var readNoiseLabel = labelContainer.append('span')
        .style('margin','5')
        //.html(self.readNoise + ' e<sup>-</sup> Read Noise')
        .attr('class','windowLabel')
    
    var QElabel = labelContainer.append('span')
        .style('margin','5px')
        //.html(Math.round(self.QE*100) + '% QE')
        .attr('class','windowLabel')

    var FPSlabel = labelContainer.append('span')
        .style('margin','5px')
        //.html(self.frameRateHz + ' FPS')
        .attr('class','windowLabel')
    
    self.updateQELabel = function(n){
        QElabel.html(Math.round(self.QE*100) + '% QE')
    }

    self.updateReadNoiseLabel = function(n){
        if (self.readNoise < 1){
            //readNoiseLabel.html('<1 e<sup>-</sup> Read Noise')
            return
        }
        //readNoiseLabel.html(self.readNoise + ' e<sup>-</sup> Read Noise')
    }

    self.updateFPSLabel = function(n){
        //FPSlabel.html(self.frameRateHz + ' FPS')
    }

    // create image data
    self.simImage = new Arr2d(self.xPixels, self.yPixels, 0)

    if (self.hasRealImage & !self.imageSource){
        var v = 0;
        var w = 0;
        self.realImage = new Arr2d(self.xPixels, self.yPixels, 0);
        for (var i = 0; i < self.xPixels; i++){
            for (var j = 0; j < self.yPixels; j++){
               v = ((Math.sin(0 + ( (i) * self.xPixelSize) / 42.5))+1) / 2;  
               w = ((Math.sin(0 + ( (j) * self.yPixelSize) / 42.5))+1) / 2;
               self.realImage.set(i,j, v*w);
            }
        }
        
    }

    if (self.shortName){
        self.realImage = new Arr2d(self.xPixels, self.yPixels, 0);
        self.realImage.data = jsonImage[self.shortName + app.activeDataSet];
    }

    this.updateData = function(){

        self.QE = self.model.getQE(app.wavelength);
        if(!self.QE){
            self.QE = 0;
        }
        self.updateQELabel(self.QE);

        // overwrite / erase the current data in the simulated image data
        self.simImage.data.fill(0);
        

        // start with a simple background of read noise, offset by 2 counts

        var emGain = 0;
        if (self.amplifier == 'conventional'){
            emGain = 1;
        }
        else {
            emGain = self.emGain;
        }

        for( var i = 0; i<app['numAccumulations']; i++){
            self.simImage.data = arraySum(self.simImage.data, randnSample(numSamples = self.xPixels * self.yPixels, mu = self.offset, sigma = self.readNoise / emGain));
            

            // I'd like to add a feature which efficienty adds CIC noise.  I'd rather not roll each pixel
            // separately, but rather generate a random number of points based on the self.CIC property
            var nCicPoints = Math.round( poissonSample(self.xPixels * self.yPixels * self.CIC) );

            
            for (var j = 0; j < nCicPoints; j++){
                var xCoord = Math.floor( Math.random() * self.xPixels );
                var yCoord = Math.floor( Math.random() * self.yPixels );
                self.simImage.set(xCoord, yCoord, self.offset + (1+5*Math.random()));
            }
        

            // generate data from stored image using poisson sampling
            if(self.hasRealImage){
                var q;
                var areaFrac = (self.xPixelSize * self.yPixelSize) / (16*16);
                for (var x1 = 0; x1 < self.xPixels; x1++){
                    for (var x2 = 0; x2 < self.yPixels; x2++){
                        q = poissonSample(app.featureBrightness * self.QE * app['exposureTime'] * areaFrac * self.realImage.get(x1,x2) , 1)[0];
                        self.simImage.set(x1,x2, q + self.simImage.get(x1,x2));
                    }
                }
                
            }
        }



    }

    this.draw = function(){
        var arr = self.simImage;
        var areaFrac = 1;
        var readNoise = self.readNoise;
        if (self.amplifier == 'em'){
            readNoise = readNoise / self.emGain;
        }
        if (self.hasRealImage){
            areaFrac = (self.xPixelSize * self.yPixelSize) / (16*16);
        } 

        var darkCounts = self.darkCurrent * app['exposureTime'] * app['numAccumulations'];
        var arrMax = app['numAccumulations'] * (self.offset + 2 * readNoise + self.QE * areaFrac * app.exposureTime * app.featureBrightness + 0.5 * Math.sqrt(self.QE * areaFrac * app.featureBrightness )) + darkCounts;//Math.max(...arr.data);
        var arrMin = app['numAccumulations'] * (self.offset - 2 * readNoise - Math.sqrt(darkCounts)) + darkCounts;
        var arrRange = arrMax - arrMin;
        
        var canvas = this.canvas._groups[0][0];
        var context = canvas.getContext("2d");
        var scale = self.xPixelSize * self.displayScale;

        // use context.putImageData to draw the data to the canvas
        var img = new ImageData(self.xPixels, self.yPixels);
        for (var i = 0; i<img.data.length; i+=4){
            var k = Math.floor(i/4)%self.xPixels;
            var l = Math.floor ( Math.floor(i/4) / self.xPixels);
            var v = Math.round( 255*(arr.data[i/4]-arrMin)/arrRange );
            img.data[i+0] = v;
            img.data[i+1] = v;
            img.data[i+2] = v;
            img.data[i+3] = 255;
        }
        context.putImageData(img,0,0);
        
    }

    this.remove = function(){
        self.div.remove();
    }


}



//2d array object to hold data

function Arr2d(n,m,val){
    
    var self = this;
    self.n = n;
    self.m = m;
    self.val = val;
    self.data = [];
    self.data.length = n*m;
    self.data.fill(val);
    self.length = self.data.length;
    
    self.get = function(i,j){
        return self.data[j*n + i];
    }

    self.set = function(i,j, v){
        self.data[j*n + i] = v;
    }

    self.mapData = function(f){
        self.data = self.data.map(f);
        return self
    }

    self.randomizeData = function(){
        self.data = randnSample(numSamples = self.n*self.m, mu = 2, sigma = 2)
    }
}

// initialize an instrument panel
function initializeControls(){

    featureBrightnessConfig = {
        controlName : 'featureBrightness',
        labelText : 'Signal Peak, Photons',
        parameter : 'featureBrightness',
        min : 0,
        max : 100,
        defaultValue: 3
    }

    featureWidthConfig = {
        controlName : 'featureWidth',
        labelText : 'Feature FWHM, Px',
        parameter : 'featureSigma',
        min : 1,
        max : 30,
        defaultValue : 5
    }

    wavelengthConfig = {
        controlName : 'wavelength',
        labelText : 'Wavelength, nm',
        parameter : 'wavelength',
        min : 300,
        max : 1000,
        defaultValue : 500
    }

    var createSlider = function(configObj){
        var sliderDiv = d3.select('#mainControls')
        .append('div')
        .attr('class','sliderLabel')
        .attr('id', configObj.controlName+'sliderDiv')
        .text(configObj.labelText + ' - ')

        var sliderLabel = sliderDiv.append('span')
            .attr('class','sliderLabel')

        sliderLabel.text(configObj.defaultValue)

        var slider = sliderDiv
            .append('input')
            .attr('type','range')
            .attr('min', configObj.min)
            .attr('max', configObj.max)
            .attr('value', configObj.defaultValue)
            .attr('step', 1)
            .style('width','300px')
            .attr('class','slider')
        

        var sliderCallBackFactory = function(configObj){
            var f = function(){
                self = this;
                app[configObj['parameter']] = Number(self.value);
                sliderLabel.text(self.value);
                cameras.forEach(x=>x.updateData());
                cameras.forEach(x=>x.draw());
            }
            return f;
        }
        slider.on('input', sliderCallBackFactory(configObj));
        return slider;
    }

    createSlider(featureBrightnessConfig);
    //createSlider(featureWidthConfig);
    createSlider(wavelengthConfig);


    // add a drop down selector for data type
    d3.select('#mainControls').append('hr');
    var chooserDiv = d3.select('#mainControls').append('div').attr('class','sliderLabel');
    chooserDiv.append('span').text('Data Set : ');
    var dataSetChooser = chooserDiv.append('select').attr('name','dataSet');
    dataSetChooser.append('option').property('value','0').text('Cells 0')
    dataSetChooser.append('option').property('value','1').text('Cells 1')
    dataSetChooser.on('change', function(){
        var self = this;
        app.activeDataSet = this.value;
        cameras.forEach(function(cam){
            cam.realImage.data = jsonImage[cam.shortName + self.value];
            cam.updateData();
            cam.draw();
        });
        
    })


    d3.select('#mainControls').append('hr')

    var checkBoxDiv = d3.select('#mainControls')
    .append('div')
    .attr('class','sliderLabel')
    .attr('id', 'checkBoxDiv')
  
checkBoxDiv
    .append('label')
    .text("Fast Mode - Simulate Max Frame Rate")
    .append('input')
    .attr('type','radio')
    .attr('name','mode')
    .attr('value','Fast')
    .attr('id','Fast')
    .attr('checked','true')

checkBoxDiv
    .append('label')
    .text("Slow Mode - Simulate 30 Second Exposure")
    .append('input')
    .attr('type','radio')
    .attr('name','mode')
    .attr('value','Slow')
    .attr('id','Slow')


}

// timing variables
var start = null;
var delta = 0;

// add some sample cameras to the screen
var cameras = [];



// show different cameras
if (1){

    d3.select('#mainContainer')
        .append('div')
        .attr('id','subContainer')
}

 
function startAnimation(timestamp) {
  if (!start) start = timestamp;
  start = timestamp;
  window.requestAnimationFrame(animate);
}

function modRange(a, lowerLim, upperLim){
    if (a > upperLim){
        return lowerLim;
    }
    if (a < lowerLim ){
        return upperLim;
    }
    return a;
}


// animate camera
function animate(){

    var readTime = (cameras[0].xPixels * cameras[0].yPixels) / (app['readOutRate'] * 10**6)
    app['cycleTime'] = app['numAccumulations'] * (app['exposureTime'] + readTime);

    var frameRateMultiplier = Math.min(...cameras.map(x=>(1/x.frameRateHz)));
    delta++;
    if (delta % Math.round(app.cycleTime*60) == 0){
        cameras.forEach( function(cam){
            cam.updateData();
            cam.draw();
        })
    }
        window.requestAnimationFrame(animate);
}


// set up controls and start the animation process
initializeControls();

// add an iXon897 here
cameras.push(new Camera(cameraDefs['iXon897']))
cameras.forEach( function(cam){
    cam.readNoise = cam['readNoise' + app.mode];
    cam.frameRateHz = cam['frameRateHz' + app.mode];
    console.log(app.mode);
    cam.updateData();
    cam.draw();
} );

// generate a frame to beforehand to avoid weird moire
cameras.forEach( function(x){
    x.updateFPSLabel();
    x.updateQELabel();
    x.updateReadNoiseLabel();
    x.draw()
} )

startAnimation();