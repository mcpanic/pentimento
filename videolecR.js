var Grapher = function() {
    exports = {};
    var c;
    var context;
    var contextHeight=600;
    
    var ymax=800;
    var ymin=0;
    var xmin=0;
    var xmax=1100;
    var yscale;
    var xscale;
    var previousZoom = 1;
    var translateX = 0;
    var translateY = 0;
    var totalZoom = 1;
    
    var audio;
    
    var lines = new Array();
    var patterns = [/[numberofPrimitives=][0-9]+/ig, 
                    /[numberofVertices=][0-9]+/ig, 
                    /[0-9.]+/ig];
    var dataPoints = new Array();
    //array of strokes. one stroke is an array of [x,y,t],[x,y,t],...
    
    var imax;	// maximum time value
    
    var initialTime; //initial time of start of video
    var currentI=0; //current index of time (in seconds)
    var currentTime; //current time, as given by date.now();
    var offsetTime=0; //for use with pause
    var paused=true;
    var setTime=false; //true if time was set by slider or strokeFinding
    var wasPanning = false; //true if currently panning/zooming
    var draw;
    
    var numStrokes=0;
    var dataArray;
    
    /*
        how the json is organized:
        array of stroke objects
        stroke: {
            verticies: [ {"x": 0, "y": 0, "t": 0, "pressure":0}, {} ...],
            properties: [ {"type": "", "time": 0, "thickness":0, "color":0..., "colorfill": 0...}, {} ...]
        }
        length: 0 (length of total lecture in seconds)
        height: 0
        width: 0 (both of the lecture screen)
    */
    
    // updates lines and dataPoints with new file
    function getData(file) {
        console.log(JSON.parse(file.responseText));
        dataArray = JSON.parse(file.responseText);
        //REPLACE dataPoints WITH dataArray!!!!!!!!!!!!!!!
        console.log(dataArray.strokes[0]);
        imax = dataArray.strokes.length;
        console.log("imax: "+imax);
        $('#slider').slider("option","max",imax);
        slider.max=imax;
        numStrokes=dataArray.strokes.length;
    }

	function readFile(url, callback) {
		var txtFile = new XMLHttpRequest();
		txtFile.open("GET", url, true);	
		//txtFile.setRequestHeader('User-Agent','XMLHTTP/1.0');
		txtFile.onreadystatechange = function() {
			if (txtFile.readyState != 4) {return;}  // document is ready to parse.	
			if (txtFile.status != 200 && txtFile.status != 304) {return;}  // file is found
			callback(txtFile);
		}
		if (txtFile.readyState == 4) return;
		txtFile.send(null);
	}
    
    
    //called when you click on the canvas
    function selectStroke(x,y){
        x=x/xscale;
        y=(c.height-y)/yscale;
        var minDistance=5; //if the point is further than this then ignore it
        var closestPoint={stroke:-1,point:-1,distance:minDistance,time:0};
        var done=false;
        for(var i=0; i<numStrokes; i++){
            var currentStroke=dataArray.strokes[i];
            for(var j=0;j<currentStroke.length; j++){
                if (currentStroke[j][2]<currentI){
                    //check closeness of x,y to this current point
                    var dist = getDistance(x,y,currentStroke[j][0],currentStroke[j][1])
                    if (dist<closestPoint.distance){
                        closestPoint.distance=dist;
                        closestPoint.stroke=i;
                        closestPoint.point=j;
                        closestPoint.time=currentStroke[j][2];
                    }
                }else{
                    done=true;
                    break;
                }
            }
            if (done) break;
        }
        
        console.log(closestPoint);
        if (closestPoint.stroke!= -1){ //it found a close enough point
            var time=parseFloat(dataPoints[closestPoint.stroke][0][2]); //TODO: CHANGE TO NEW DATA ARRAY
            offsetTime=time*1000;
            setTime=true;
            context.clearRect(0,0,c.width,c.height);
            oneFrame(time);
            changeSlider(time);
            audio.currentTime=time;
        }
        if(!paused){ // if it wasn't paused, keep playing
            paused=true; //it only starts if it was previously paused.
            start();
        }
    }
    
    function getDistance(x1,y1,x2,y2){
        return Math.sqrt( (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    }
    
    function graphData(){
		context.clearRect(0,0,c.width,c.height);
		currentTime=Date.now(); //gets current time
		currentI=(currentTime/1000.0)-(initialTime/1000.0) //converts to seconds passed
		changeSlider(currentI);
        oneFrame(currentI);
        if (currentI>imax) stop();
	}
    
/*************I MADE CHANGES 7/24*****************/    
    //draw a parallelogram for each pair of points
    function calligraphize(context, x, y) {
        var penWidth = 4*xscale;
        context.lineTo(x-penWidth,y+penWidth);
        context.lineTo(x,y);
        context.closePath();
        context.moveTo(x,y);
        context.lineTo(x-penWidth,y+penWidth);
    }
    
    //CHANGE TO WORK WITH NEW DATA!!!!
    function oneFrame(current){
        var done=false;
        for(var i=0; i<numStrokes; i++){
			//var data = dataPoints[i];
            var data = dataArray.strokes[i].vertices;
			context.beginPath();
            context.lineWidth = xscale/8;
//			context.moveTo((data[0][0]*xscale),ymax*yscale-data[0][1]*yscale);
			
			for (var j = 0; j < data.length; j++) {
				if (data[j].t < current){
					var x=data[j].x*xscale
					var y=data[j].y*yscale	
//					context.lineTo(x,ymax*yscale-y);
                    calligraphize(context,x,ymax*yscale-y);
				}else {
                    done=true;
					break;}
			}
            context.fill();
            context.stroke();
            if (done) break;
        }
    }
/***************END CHANGES*******************/
    
    function changeSlider(current){
        if (current<imax){ 
            $('#slider').slider('value',current);
            //current is # of seconds...convert that to minutes & sec
            var secondsPassed=parseFloat(current);
            var minutes=Math.floor(secondsPassed/60);
            var seconds=Math.round((secondsPassed - minutes*60)*10)/10;
            var zeros='';
            if (seconds % 1 === 0 ) zeros='.0';
            root.find('.time').html(minutes+":"+seconds+zeros);
        }
    }
    
    //triggered on every mouse move
    function sliderTime(){
        var val=$('#slider').slider('value');
        var pausedTime=val*1000;
        setTime=true;
        offsetTime=pausedTime;
        currentI=val;
		context.clearRect(0,0,c.width,c.height);
        oneFrame(val);
        changeSlider(val);
        //audio.currentTime=val;
    }
    
    //triggered after a user stops sliding
    function sliderStop(event, ui){
        if (paused){ //if it was paused, don't do anything
            return;
        }
        paused=true; //only starts if it was previously paused
        start();
    }
    
    //triggered when user starts sliding
    function sliderStart(event, ui){
        var initialpause=paused;
        pause();
        paused=initialpause;
    }
    
    function start(){
        if(paused){
            //I MADE CHANGES 7/24
            context.restore();
            //7/25
            $('#slider-vertical').slider({disabled:true,value:1});
            $('#zoomlabel').html(1);
            previousZoom = 1;
            translateX = 0;
            translateY = 0;
            totalZoom = 1;
            wasPanning = false;
            
            paused=false;
            setTime=false;
            initialTime=Date.now()-offsetTime;
            draw=setInterval(graphData,50);
            audio.play();
        }
    }
    
    function pause(){
        //I MADE CHANGES 7/24
        if(!wasPanning)
            context.save();
        //7/25
        $('#slider-vertical').slider({disabled:false});
        
        paused=true;
        draw=clearInterval(draw);
        audio.pause();
        var pausedTime=Date.now();
        if (!setTime) {
            if (initialTime==null)
                offsetTime=0;
            else
                offsetTime=pausedTime-initialTime;
        }
    }
    
    function stop(){
        paused=true;
        draw=clearInterval(draw);
        
        //I MADE CHANGES 7/24
        context.clearRect(0,0,c.width,c.height);
        //7/25
        context.save();
        $('#slider-vertical').slider({disabled:true,value:1});
        $('#zoomlabel').html(1);
        previousZoom = 1;
        translateX = 0;
        translateY = 0;
        totalZoom = 1;
        //END CHANGES
        $('#slider').slider('value', 0);
        root.find('.time').html('0');
        
        audio.pause();
        //audio.currentTime=0;
        offsetTime=0;
    }
    
    function resizeControls(vidWidth){
        
        $('.controls').css('width', vidWidth);
        
        var buttonWidths=parseInt((vidWidth/4-20)/3);
        $('.buttons').css('width', vidWidth/4);
        $('.pause').css('width',buttonWidths);
        $('.start').css('width',buttonWidths);
        $('.stop').css('width',buttonWidths);
        $('.pause').css('background-size',buttonWidths);
        $('.start').css('background-size',buttonWidths);
        $('.stop').css('background-size',buttonWidths);
        
        $('.timeControls').css('width',vidWidth/4*3);
        
        $('#slider').css('width',vidWidth/2-10);
        $('#slider').css('margin-top',buttonWidths/2);
        //I MADE CHANGES 7/25
        $('.zoomslider').css('height',vidWidth/3);
        
        $('.time').css('margin-top',buttonWidths/2);
                         
        
        
        oneFrame(currentI);
    }
    
    function jumpForward(){
        jump(10);
    }
    
    function jumpBack(){
        jump(-10);
    }
    
    function jump(val){
        var initialpause=paused;
        pause();
        paused=initialpause;
        var time=currentI+val;
        if (time > imax) time = parseInt(imax);
        if (time < 0) time=0;
        currentI=time;
        offsetTime=time*1000;
        setTime=true;
        
        context.clearRect(0,0,c.width,c.height);
        oneFrame(time);
        changeSlider(time);
        audio.currentTime=time;
        
        if(!paused){ // if it wasn't paused, keep playing
            paused=true; //it only starts if it was previously paused.
            start();
        }
    }
    
    function resetControlSize(){
        $('.controls').css('width', '575px');
        $('.buttons').css('width', '175px');
        $('.pause').css('width','50px');
        $('.start').css('width','50px');
        $('.stop').css('width','50px');
        $('.pause').css('background-size','50px');
        $('.start').css('background-size','50px');
        $('.stop').css('background-size','50px');
        $('.timeControls').css('width','375px');
        $('#slider').css('width','300px');
        $('#slider').css('margin-top','20px');
        //I MADE CHANGES 7/25
        $('.zoomslider').css('height', '190px');
        $('.time').css('margin-top','20px');
        oneFrame(currentI);
    }
    
    function resizeVisuals(){
        var c=$('.pentimento').find('.video')[0];
        var windowWidth=$(window).width();
        var windowHeight=$(window).height();
        //console.log(windowHeight,windowWidth);
        //$('#errorcheck').html(windowHeight+' ,'+windowWidth);
        var videoDim;
        //fit canvas to window width
        if (windowWidth>(windowHeight+150)) { //take smaller of the two
            videoDim=(windowHeight-200);
            if (videoDim<100) {
                videoDim=100;
            }
            var scaleFactor=ymax;
            //$('#errorcheck').append(' y ' + videoDim);
        }
        else {
            videoDim=windowWidth-125;
            var scaleFactor=xmax;
            //$('#errorcheck').append(' x');
        }
        //console.log(windowHeight,windowWidth,videoDim);
        c.height=ymax * videoDim/scaleFactor;
        c.width=xmax * videoDim/scaleFactor;
        yscale=(c.height)/ymax;
        xscale=(c.width)/xmax;
        if (c.width<575) {
            resizeControls(c.width);
        }
        else { resetControlSize(); }
    }
    
    var template="<div class='lecture'>"
        + "<canvas class='video' style='cursor:crosshair;'></canvas>"
    //I MADE CHANGES 7/25
        + "<div class='zoomslider' style='display:inline-block;position:absolute;margin-left:10px;'>"
        + "+<div id='slider-vertical' style='height:75%;'></div>-"
        + "<div id='zoomlabel'>1</div>"
        + "</div>"
    //END CHANGES
        + "<br> <div class='controls'>"
        + "<div class='buttons'>"
        + "<input class='start' type='button'/>"
        + "<input class='pause' type='button'/>"
        + "<input class='stop' type='button'/>"
        + "</div>"
        + "<div class='timeControls'>"
        + "<div id='slider'></div>"
        + "<div class='time'>0</div>"
        + "</div>"
        + "<audio class='audio' preload='auto'>"
        + "     <source id='lectureAudio' type='audio/mpeg'>"
        + "</audio>"
        + "</div>"
        + "</div>";
    exports.initialize = function() {
        root = $("<div class='pentimento'></div>").appendTo($('body'));
        root.append(template);
        
        audio=root.find('.audio')[0];
        var source=root.find('#lectureAudio');
        source.attr('src',audioSource).appendTo(source.parent());
        
        $('.buttons').append('<button class="jumpBack"> < 10s </button>');
        $('.buttons').append('<button class="jumpForward"> 10s > </button>');
        
        $('#slider').slider({
            max:100,
            min:0,
            step:.1,
            range: 'max',
            stop: sliderStop,
            start: sliderStart,
            slide: sliderTime,
            change: function(event,ui){
                if (event.originalEvent) {
                    sliderStart();
                    sliderTime(event,ui);
                    sliderStop();
                    }
                }
                    //only call if it was a user-induced change, not program-induced
        });
        
/*********************I MADE CHANGES 7/25********/
        $('#slider-vertical').slider({
            disabled: true,
            orientation: 'vertical',
            range: 'min',
            min: 0.5,
            max: 2,
            step: 0.1,
            value: 1,
            slide: function(event, ui) {
                wasPanning = true;
                totalZoom = ui.value;
                var newZoom = totalZoom/previousZoom;
                $('#zoomlabel').html(totalZoom);
                context.clearRect(0,0,c.width,c.height);
                context.scale(newZoom, newZoom);
                context.translate((1-newZoom)*c.width/4,(1-newZoom)*c.height/4);
                translateX += (1-newZoom)*c.width/4;
                translateY += (1-newZoom)*c.height/4;
                previousZoom = totalZoom;
                oneFrame(currentI);
            }
        });
/*********************END CHANGES****************/
        
//        var windowWidth=$(window).width();
//        var windowHeight=$(window).height();
//        var videoDim;
//        //fit canvas to window width
//        if (windowWidth>(windowHeight+150)) { //take smaller of the two
//            videoDim=(windowHeight-200);
//            var scaleFactor=ymax;
//        }
//        else {
//            videoDim=windowWidth-125;
//            var scaleFactor=xmax;
//        }
//        console.log(windowWidth,windowHeight);
        
        
        c=root.find('.video')[0];
        
        resizeVisuals();
        
//        c.height=ymax * videoDim/scaleFactor;
//        c.width=xmax * videoDim/scaleFactor;
        context=c.getContext('2d');
		context.strokeStyle='black';
		context.lineCap='round';
        
/*****************I MADE CHANGES 7/24****************/
        var isPanning = false,
            previousX,
            previousY,
            pausedBeforePan = false;
        //begins listening for drag-to-pan
        c.addEventListener('mousedown', function(e) {
            isPanning = true;
            previousX = e.x;
            previousY = e.y;
            if(!wasPanning) {
//                pausedBeforePan = paused;
                pause();
            }
            wasPanning = false;
        });
        //translates canvas with mouse drag
        c.addEventListener('mousemove', function(e) {
            if(isPanning) {
                wasPanning = true;
                context.clearRect(0,0,c.width,c.height);
                context.translate(e.x-previousX, e.y-previousY);
                translateX += e.x-previousX;
                translateY += e.y-previousY;
                oneFrame(currentI);
                previousX = e.x;
                previousY = e.y;
            }
        });
        //stops listening for pan
        c.addEventListener('mouseup', function(event) {
            isPanning = false;
            
            //I MADE CHANGES 7/24
            if(!wasPanning) {
                paused = false;
                var mx=event.pageX;
                var my=event.pageY;
                var offset=root.find('.video').offset(); //array of left and top
                mx=Math.round((mx-offset.left-translateX)/totalZoom);
                my=Math.round((my-offset.top-translateY)/totalZoom);
                console.log(mx, my, translateX, translateY);
                selectStroke(mx,my);
            }
        });
        
        context.save();
/*********************END CHANGES***************/
        
//        if (c.width<575) {
//            resizeControls(c.width);
//        }
        
//        yscale=(c.height)/ymax;
//        xscale=(c.width)/xmax;
        readFile(datafile,getData); //dataPoints now filled with data
        
        root.find('.jumpForward').on('click',jumpForward);
        root.find('.jumpBack').on('click',jumpBack);
        
        root.find('.pause').on('click',pause);
        root.find('.start').on('click',start);
        root.find('.stop').on('click',stop);
        
        $(window).on('resize',resizeVisuals);
    }
    return exports;
};


(function() {
    var createGrapher = function() {
        window.grapher = Grapher(jQuery);
        window.grapher.initialize();
    }

    // Add the CSS file to the HEAD
    var css = document.createElement('link');
    css.setAttribute('rel', 'stylesheet');
    css.setAttribute('type', 'text/css');
    css.setAttribute('href', 'style.css'); // XXX TODO CHANGEME!!
    document.head.appendChild(css);

    if ('jQuery' in window) {
      createGrapher(window.jQuery);
    } else {
        // Add jQuery to the HEAD and then start polling to see when it is there
        var scr = document.createElement('script');
        scr.setAttribute('src',
                    'http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js');
        document.head.appendChild(scr);
        
        //script . onload (do this stuff) instead of doing a setInterval
        
        var t = setInterval(function() {
            if ('jQuery' in window) {
                var scr2 = document.createElement('script');
                scr2.setAttribute('src',
                    'http://code.jquery.com/ui/1.10.3/jquery-ui.js');
                document.head.appendChild(scr2);
                clearInterval(t); // Stop polling 
                createGrapher();
            }
        }, 50);
    }
})();


/*
TODO:
-resize window, fill up browser size
    -maintain stroke width
-minimize amount of things you have to put in the actual html
-reorganize data so that you have type of stroke in it
    (so you can do color, highlight, etc)
    
    changes over time
    color
    stroke width
    
    background slides
    
    user interacting drag
        -have a 'return to default' button
    
    each stroke will have its own list of events (events over time)
    & lecture itself will have a list of events
    
CURRENT BUGS:

*/