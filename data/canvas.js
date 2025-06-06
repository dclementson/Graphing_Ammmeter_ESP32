/**
 * ----------------------------------------------------------------------------
 * ESP32 Graphing Ammeter
 * ----------------------------------------------------------------------------
 * ----------------------------------------------------------------------------
 */

var messageCounter = 0;
var messageSendMilis;
var currentMillis = 0;
var currentTrigFlag = 0;
var lastTrigFlag = 0;
var connection;
var dateObject;
var sampleInterval = 2;
var messageInterval = 50;
var chartSize = 10000;
var scopeSamples1 = []; // Primary Y axis
var scopeSamples2 = []; // Primary Y axis
var scopeSamples3 = []; // Primary Y axis
var scopeSamples4 = []; // Primary Y axis
var scopeSamples5 = []; // Primary Y axis
var scopeSamplesT = []; // Primary Y axis
var chartScope;
var chartMillis = 0;
var ampScale = 5 / 4095;
var ampOffset = 0;
var vertCal = 3.3 / 4095;
var autoScale = 2;
var gateway = `ws://${window.location.hostname}/ws`;
var websocket;

// wrap "new CanvasJS.Chart" into a function
// to be able move stripLines by calling this function
function setupScopeChart() {
  chartScope = new CanvasJS.Chart("chartScope", {
    theme: "dark1",
    title: {
      text: "Logging Ammeter",
      fontSize: 20,
      fontFamily: "arial",
    },
    axisX: {
      // title: "Time",
      gridColor: "#555555",
      titleFontSize: 15,
      minimum: 0,
      maximum: chartSize,
      viewportMaximum: chartSize,
      tickThickness: 2,
      gridDashType: "solid",
      gridThickness: 2,
      valueFormatString: " ",
    },
    axisY: {
      title: "Current",
      suffix: "A",
      gridColor: "#555555",
      gridThickness: 2,
      gridDashType: "solid",
      titleFontSize: 15,
      minimum: -25,
      maximum: 25,
      interval: 5,
    },
    toolTip:{
		  shared:true
	  },  
    legend:{
      cursor:"pointer",
      verticalAlign: "bottom",
      horizontalAlign: "left",
      dockInsidePlotArea: true,
    },
    data: [
      {
        color: "red",
		    showInLegend: true,
        name: "Channel 1",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples1,
      },
            {
        color: "cyan",
        showInLegend: true,
        name: "Channel 2",        
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples2,
      },
            {
        color: "blue",
      	showInLegend: true,
        name: "Channel 3",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples3,
      },
            {
        color: "green",
    		showInLegend: true,
        name: "Channel 4",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples4,
      },
            {
        color: "yellow",
    		showInLegend: true,
        name: "Channel 5",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples5,
      },
            {
        color: "white",
    		showInLegend: true,
        name: "Total",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamplesT,
      },
    ],
  });
  chartScope.render();
  //chartRescale();
}

function chartRescale() {
  chartScope.axisX[0].set("minimum", 0, false);
  chartScope.axisX[0].set("maximum", chartSize, false);
  chartScope.axisX[0].set("viewportMaximum", chartSize, false);
}
      
function parseMessage(message) {
  var fields = message.data.split(" ");

  // check only messages begining with '#'
  if (fields[0] == "#") {
    // check if received message number
    // is the same as that one sent
    if (fields[1] != messageCounter) {
      // we have received back a message
      // with different number than just sent
      connection.close();
    } else {
      var analogPairs = fields[2].split(";");
      if (analogPairs[0] == "-") {
        // no data captured yet
        // the scope chart will not be updated
      } else {
        // we have received new data
        // use the data to update the scope chart

        //Extract the measurement data: [millis since last sample, current sample value]
        for (var i = 0; i < analogPairs.length; i++) {
          var analogSamples = analogPairs[i].split("@");
          currentMillis = currentMillis + parseInt(analogSamples[0]);
          var ch1Value = ((parseInt(analogSamples[1]) * ampScale) - ampOffset);
          var ch2Value = ((parseInt(analogSamples[2]) * ampScale) - ampOffset);
          var ch3Value = ((parseInt(analogSamples[3]) * ampScale) - ampOffset);
          var ch4Value = ((parseInt(analogSamples[4]) * ampScale) - ampOffset);
          var ch5Value = ((parseInt(analogSamples[5]) * ampScale) - ampOffset);
          currentTrigFlag = parseInt(analogSamples[6]);
          var chTValue = ch1Value + ch2Value + ch3Value + ch4Value + ch5Value;          
          if (currentTrigFlag != lastTrigFlag){
              lastTrigFlag = currentTrigFlag;
          }
          
          // send to display here
          document.getElementById("CurrentVal1").innerHTML=ch1Value.toFixed(1) + " A";
          document.getElementById("CurrentVal2").innerHTML=ch2Value.toFixed(1) + " A";
          document.getElementById("CurrentVal3").innerHTML=ch3Value.toFixed(1) + " A";
          document.getElementById("CurrentVal4").innerHTML=ch4Value.toFixed(1) + " A";
          document.getElementById("CurrentVal5").innerHTML=ch5Value.toFixed(1) + " A";
          document.getElementById("CurrentValT").innerHTML=chTValue.toFixed(1) + " A";
          //  Push the X,Y sample into the graph buffer ====>
          scopeSamples1.push({
            // data to the display
            x: chartMillis,
            y: ch1Value,
          });
          scopeSamples2.push({
            // data to the display
            x: chartMillis,
            y: ch2Value,
          });
          scopeSamples3.push({
            // data to the display
            x: chartMillis,
            y: ch3Value,
          });
          scopeSamples4.push({
            // data to the display
            x: chartMillis,
            y: ch4Value,
          });
          scopeSamples5.push({
            // data to the display
            x: chartMillis,
            y: ch5Value,
          });
          scopeSamplesT.push({
            // data to the display
            x: chartMillis,
            y: chTValue,
          });


          chartMillis = chartMillis + parseInt(analogSamples[0]); //update display pointer
          if (chartMillis >= chartSize) {
            chartMillis = 0;
            scopeSamples1.length = 0;
            scopeSamples2.length = 0; 
            scopeSamples3.length = 0;
            scopeSamples4.length = 0;
            scopeSamples5.length = 0;
            scopeSamplesT.length = 0;
          }
        }
      }

      setTimeout(sendMessage, messageInterval);
      chartScope.render();
      var statusWindow = document.getElementById("statusWindow");
      statusWindow.textContent = "Received message # " + messageCounter;
    }
  }
};


function disconnect() {
  if (connection) {
    connection.close();
  } else {
    connectionStatus.value = "Not connected yet";
  }
}

function sendMessage() {
  messageCounter++;
  //dateObject = new Date();
  //messageSendMilis = dateObject.getTime();
  //
  // Message format
  // # MESSAGE_NUMBER SAMPLE_InNTERVAL
  //
  websocket.send("# " + messageCounter + " " + sampleInterval);
}

function openWindow(evt, windowName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(windowName).style.display = "block";
  evt.currentTarget.className += " active";
}

function onLoad(event) {
  setupScopeChart();
  initWebSocket();
}

function initWebSocket() {
    console.log('Trying to open a WebSocket connection...');
    websocket = new WebSocket(gateway);
    websocket.onopen  = onOpen;
    websocket.onclose = onClose;
    websocket.onmessage = onMessage;
}

function onOpen(event) {
    console.log('Connection opened');
    sendMessage();
}

function onClose(event) {
    console.log('Connection closed');
    setTimeout(initWebSocket, 2000);
}

function onMessage(event) {
    //console.log(`Received a notification from ${event.origin}`);
    //console.log(event);
    parseMessage(event);
}

// Get the element with id="defaultOpen" and click on it
//document.getElementById("defaultOpen").click();

window.addEventListener('load', onLoad);


const form_SR = document.getElementById('formSR');
form_SR.addEventListener('change', function() {
  sampleInterval = document.querySelector('input[name="sampleInterval"]:checked').value;
  //console.log("sample interval = " + sampleInterval);
});

const form_MR = document.getElementById('formMR');
form_MR.addEventListener('change', function() {
  messageInterval = document.querySelector('input[name="messageInterval"]:checked').value;
  //console.log("message interval = " + messageInterval);
});

const form_CS = document.getElementById('formCS');
form_CS.addEventListener('change', function() {
  chartSize = document.querySelector('input[name="chartSize"]:checked').value;
  chartRescale();
  //console.log("chate size = " + chartSize);
});

const form_AS = document.getElementById('formAS');
form_AS.addEventListener('change', function() {
  autoScale = document.querySelector('input[name="autoScale"]:checked').value;

    chartScope.axisY[0].set("minimum", ((autoScale == 1) ? null : -25), false);
    chartScope.axisY[0].set("maximum", ((autoScale == 1) ? null : 25), false);
    chartScope.axisY[0].set("interval", ((autoScale == 1) ? null : 5), false);
  //console.log("Auto Scale = " + autoScale);
});

