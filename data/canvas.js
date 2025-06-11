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
var scopeSamples6 = []; // Primary Y axis
var scopeSamplesT = []; // Primary Y axis
var chartScope;
var chartMillis = 0;
var chartSecs = 0;
var ampScale = 23.5 / 2048;
var voltScale = 53 / 4096;
var ampOffset = 2000;
var autoScale = 2;
var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
var runFlag = 1;
var collectFlag = 1;
var ch1Enable = 0;
var ch2Enable = 0;
var ch3Enable = 0;
var ch4Enable = 0;
var ch5Enable = 0;
var chTEnable = 0;

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
      title: "Time (s)",
      //suffix: "ms",
      gridColor: "#555555",
      titleFontSize: 15,
      minimum: 0,
      maximum: chartSize,
      viewportMaximum: chartSize,
      tickThickness: 2,
      gridDashType: "solid",
      gridThickness: 2,
      valueFormatString: "#,.0",
    },
    axisY: {
      title: "Current",
      suffix: "A",
      gridColor: "#555555",
      gridThickness: 2,
      gridDashType: "solid",
      titleFontSize: 15,
      minimum: -5,
      maximum: 25,
      interval: 5,
    },
    axisY2: {
      title: "Voltage",
      suffix: "V",
      gridColor: "#555555",
      gridThickness: 2,
      gridDashType: "solid",
      titleFontSize: 15,
      minimum: -5,
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
      dockInsidePlotArea: false,
    },
    data: [
      {
        color: "red",
		    showInLegend: true,
        name: "Channel 1",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples1,
        visible: false,
      },
      {
        color: "cyan",
        showInLegend: true,
        name: "Channel 2",        
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples2,
        visible: false,
      },
      {
        color: "blue",
      	showInLegend: true,
        name: "Channel 3",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples3,
        visible: false,
      },
      {
        color: "green",
    		showInLegend: true,
        name: "Channel 4",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples4,
        visible: false,
      },
      {
        color: "yellow",
    		showInLegend: true,
        name: "Channel 5",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples5,
        visible: false,
      },
      {
        color: "white",
    		showInLegend: true,
        name: "Total",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamplesT,
        visible: false,
      },
      {
        color: "magenta",
        axisYIndex: 1,
        axisYType: "secondary",
    		showInLegend: true,
        name: "Voltage",
        type: "spline",
        markerType: "none",
        dataPoints: scopeSamples6,
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
          var ch1Value = ch1Enable ? ((parseInt(analogSamples[1]) - ampOffset) * ampScale) : 0;
          var ch2Value = ch2Enable ? ((parseInt(analogSamples[2]) - ampOffset) * ampScale) : 0;
          var ch3Value = ch3Enable ? ((parseInt(analogSamples[3]) - ampOffset) * ampScale) : 0;
          var ch4Value = ch4Enable ? ((parseInt(analogSamples[4]) - ampOffset) * ampScale) : 0;
          var ch5Value = ch5Enable ? ((parseInt(analogSamples[5]) - ampOffset) * ampScale) : 0;
          var ch6Value = ((parseInt(analogSamples[6]) * voltScale));
          currentTrigFlag = parseInt(analogSamples[7]);
          var chTValue = chTEnable ? ch1Value + ch2Value + ch3Value + ch4Value + ch5Value : 0;          
          if (currentTrigFlag != lastTrigFlag){
              lastTrigFlag = currentTrigFlag;
          }
          
          
          // send to display here
          document.getElementById("CurrentVal1").innerHTML= ch1Enable ? ch1Value.toFixed(1) + " A" : "disabled";
          document.getElementById("CurrentVal2").innerHTML= ch2Enable ? ch2Value.toFixed(1) + " A" : "disabled";
          document.getElementById("CurrentVal3").innerHTML= ch3Enable ? ch3Value.toFixed(1) + " A" : "disabled";
          document.getElementById("CurrentVal4").innerHTML= ch4Enable ? ch4Value.toFixed(1) + " A" : "disabled";
          document.getElementById("CurrentVal5").innerHTML= ch5Enable ? ch5Value.toFixed(1) + " A" : "disabled";
          document.getElementById("CurrentValT").innerHTML= chTEnable ? chTValue.toFixed(1) + " A" : "disabled";
          document.getElementById("VoltageVal").innerHTML=ch6Value.toFixed(1) + " V";

          //  Push the X,Y sample into the graph buffer ====>
          if (collectFlag) {
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
            scopeSamples6.push({
              // data to the display
              x: chartMillis,
              y: ch6Value,
            });
            scopeSamplesT.push({
              // data to the display
              x: chartMillis,
              y: chTValue,
            });

            chartMillis = chartMillis + parseInt(analogSamples[0]); //update display pointer
            if (chartMillis >= chartSize) {
              if (runFlag){
                chartMillis = 0;
                scopeSamples1.length = 0;
                scopeSamples2.length = 0; 
                scopeSamples3.length = 0;
                scopeSamples4.length = 0;
                scopeSamples5.length = 0;
                scopeSamples6.length = 0;
                scopeSamplesT.length = 0;
              } else {
                collectFlag = 0;
              }
            }
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

function toggleRun() {
  const button = document.getElementById('run')
  if (runFlag) {
    runFlag = 0;
    button.style.backgroundColor = 'orangered'; 
    button.textContent = 'Stopped';
  }
  else {
    runFlag = 1;
    collectFlag = 1;
    button.style.backgroundColor = 'palegreen'; 
    button.textContent = 'Running';
  }
  console.log(" runFlag: " + runFlag)
}

// Get the element with id="defaultOpen" and click on it
document.getElementById("defaultOpen").click();

window.addEventListener('load', onLoad);

var runButton = document.getElementById("run");
runButton.addEventListener("click", toggleRun);


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

    chartScope.axisY[0].set("minimum", ((autoScale == 1) ? null : -5), false);
    chartScope.axisY[0].set("maximum", ((autoScale == 1) ? null : 25), false);
    chartScope.axisY[0].set("interval", ((autoScale == 1) ? null : 5), false);
    chartScope.axisY2[0].set("minimum", ((autoScale == 1) ? null : -5), false);
    chartScope.axisY2[0].set("maximum", ((autoScale == 1) ? null : 25), false);
    chartScope.axisY2[0].set("interval", ((autoScale == 1) ? null : 5), false);
  //console.log("Auto Scale = " + autoScale);
});

const form_ChEn = document.getElementById('formChEn');
form_ChEn.addEventListener('change', function() {
  const ch1enableBox = document.getElementById('ch1En');
  ch1Enable = ch1enableBox.checked;
  const ch2enableBox = document.getElementById('ch2En');
  ch2Enable = ch2enableBox.checked;
  const ch3enableBox = document.getElementById('ch3En');
  ch3Enable = ch3enableBox.checked;
  const ch4enableBox = document.getElementById('ch4En');
  ch4Enable = ch4enableBox.checked;
  const ch5enableBox = document.getElementById('ch5En');
  ch5Enable = ch5enableBox.checked;
  const chTenableBox = document.getElementById('chTEn');
  chTEnable = chTenableBox.checked;

  chartScope.options.data[0].visible = ch1Enable;
  chartScope.options.data[1].visible = ch2Enable;
  chartScope.options.data[2].visible = ch3Enable;
  chartScope.options.data[3].visible = ch4Enable;
  chartScope.options.data[4].visible = ch5Enable;
  chartScope.options.data[5].visible = chTEnable;

  chartScope.render();

/*   console.log("Ch1 Enable = " + ch1Enable); 
  console.log("Ch2 Enable = " + ch2Enable); 
  console.log("Ch3 Enable = " + ch3Enable); 
  console.log("Ch4 Enable = " + ch4Enable); 
  console.log("Ch5 Enable = " + ch5Enable);  */
 
})
