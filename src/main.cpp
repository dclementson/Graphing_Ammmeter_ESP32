/* V1
  Current Logger for the Computer History Museun's DE 1401
  
  This application samples the analog inputs and one GPIO of the ESP32
  and transmits the data via websockets for display in a web browser

  The web sockets messaging scheme is based on this project:

  Repository: https://github.com/krzychb/EspScopeA0
  Author: krzychb at gazeta.pl

  ADC Channels 1-4 connect to isolated current sensors.  Channel 5 is used as
  a voltmeter.  In addition to trasmitting the voltage and current data to
  the browser, the application also monitors and records the peak current on each 
  channel, and records the peak of the sum of all five current channels. 
  Using the voltmeter channel, the application determines first when a power-up condition 
  is met, then when a loss of voltage occurs. This comprises a DUT power cycle. When 
  a power cycle is completed, the peak current values are written out and 
  appended to a file on an SD card.  The peak values are then reset and monitoring continues.

*/

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include "SD.h"
#include "SPI.h"
#include <WiFi.h>
#include <AsyncTCP.h>
#include <AsyncEventSource.h>



#define trigSensePin  23  // low = Trigger Active
#define HTTP_PORT 80
#define ADC0 36     //GPIO port numbers for ADC channels
#define ADC1 39
#define ADC2 32
#define ADC3 33
#define ADC4 34 
#define ADC5 35 
#define MAX_NUMBER_OF_SAMPLES 100 // size of FIFO ADC buffer
#define MAX_ARM_COUNT 100  //number of consecutive over-threshold voltage readings for arming
#define monitorPin GPIO_NUM_27

const char* ssid  = "ESP32-Access-Point";
const bool logging = true;  // set to "true" for SD card logging

AsyncWebServer server(HTTP_PORT);
AsyncWebSocket ws("/ws");

//
// Continuous sampling rate of A0 in this application is about 12 samples/ms
// Wi-Fi connection gets stuck if continuous A0 sampling is longer than 60ms
// Therefore maximum of 720 samples can be made
//

unsigned int samples[6][MAX_NUMBER_OF_SAMPLES];
unsigned int timeStamps[MAX_NUMBER_OF_SAMPLES];
unsigned int TrigFlags[MAX_NUMBER_OF_SAMPLES];
unsigned int numberOfSamples = MAX_NUMBER_OF_SAMPLES;
unsigned int currentSample = 0;
unsigned int sampleInterval = 10;
unsigned long millisLastSample = 0;
unsigned long messageNumber = 0;
char fileMessage[40];
bool armedFlag = false;
unsigned int trigVoltage = 10;      // peak detector arm threshold
unsigned int peakValues[6] = {0};  // peak currents & peak total current
int armCounter = 0;                 //counter for trigger debounce

void reportSD();
void triggerCheck();

void initWebServer() {
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
    server.begin();
    Serial.println("HTTP server started");
}

void sendBuffer() {
  unsigned int samplesToXmit = 0;
  String message = "# ";

  //send null message if no new samples have been taken yet
  if (currentSample == 0)  // FIF0 buffer empty
  {  
    message = message + String(messageNumber) + " -";
    // message[message.length() - 1] = '\0';
    message[message.length()] = '\0';
    //webSocket.sendTXT(socketNumber, message);
    ws.textAll(message);
  }
  else
  {
    message = message + String(messageNumber) + " ";

    for (unsigned int i = 0; i < currentSample; i++)
    {
      message = message + String(timeStamps[i]) 
      + "@" + String(samples[0][i]) 
      + "@" + String(samples[1][i]) 
      + "@" + String(samples[2][i]) 
      + "@" + String(samples[3][i]) 
      + "@" + String(samples[4][i]) 
      + "@" + String(samples[5][i])
      + "@" + String(TrigFlags[i]) 
      + ";";
    }
    currentSample = 0;  // FIFO has been emptied

    message[message.length() - 1] = '\0';
    ws.textAll(message);
  }
}
unsigned int averageADC (unsigned int ADCNum)
{
  unsigned int accum = 0;
  for (unsigned int i = 0; i < 4; i++) {
    accum += analogRead(ADCNum);
  }
  return (accum >> 2);
}

void analogSample(void)
{
  unsigned long millisCurrent = millis();
  unsigned int millisDelta = millisCurrent - millisLastSample;
  if (millisDelta > sampleInterval)
  {
    millisLastSample = millisCurrent;

    digitalWrite(monitorPin,HIGH);
   
    timeStamps[currentSample] = millisDelta;    // timestamp = millis between last samples
    samples[0][currentSample] = averageADC(ADC0); // analog current data
    samples[1][currentSample] = averageADC(ADC1); // analog current data
    samples[2][currentSample] = averageADC(ADC2); // analog current data
    samples[3][currentSample] = averageADC(ADC3); // analog current data
    samples[4][currentSample] = averageADC(ADC4); // analog current data   
    samples[5][currentSample] = averageADC(ADC5); // analog voltage data            
    TrigFlags[currentSample] = digitalRead(trigSensePin);

    unsigned int totalCurrent = 
      samples[0][currentSample] 
    + samples[1][currentSample]
    + samples[2][currentSample]
    + samples[3][currentSample]
    + samples[4][currentSample];

    // record the peak value for each channel plus the total of Channels 1-5
    peakValues[0] = samples[0][currentSample] > peakValues[0] ? samples[0][currentSample] : peakValues[0];
    peakValues[1] = samples[1][currentSample] > peakValues[1] ? samples[1][currentSample] : peakValues[1];
    peakValues[2] = samples[2][currentSample] > peakValues[2] ? samples[2][currentSample] : peakValues[2];
    peakValues[3] = samples[3][currentSample] > peakValues[3] ? samples[3][currentSample] : peakValues[3];
    peakValues[4] = samples[4][currentSample] > peakValues[4] ? samples[4][currentSample] : peakValues[4];
    peakValues[5] = totalCurrent > peakValues[5] ? totalCurrent : peakValues[5];

    currentSample += 1;

    if (currentSample >= numberOfSamples)
    {
      //Serial.println("ADC Buffer Overflow");
      currentSample = numberOfSamples - 1;  //FIFO buffer is full, overwrite last value
    }
    digitalWrite(monitorPin,LOW);

    if(logging){
      triggerCheck();
    }
  }
}

void triggerCheck(){
      if (armedFlag){
      if (samples[5][currentSample] < trigVoltage) {
        Serial.println();
        Serial.println("Power-Down event");
        reportSD();  // power down just occured
        std::fill(std::begin(peakValues), std::end(peakValues), 0);
        armCounter = 0;
        armedFlag = false;
      }
    } else {
      if (armCounter < MAX_ARM_COUNT) {
        if (samples[5][currentSample] > trigVoltage) {
          armCounter++;
        } else {
          armCounter = 0;
          std::fill(std::begin(peakValues), std::end(peakValues), 0);
        }
      } else {
        armedFlag = true;
        Serial.println();
        Serial.println("Arm event");
      }
    }
}

void onEvent(AsyncWebSocket       *server,
             AsyncWebSocketClient *client,
             AwsEventType          type,
             void                 *arg,
             uint8_t              *data,
             size_t                len) {

    switch (type) {
        case WS_EVT_CONNECT:
            Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
            break;
        case WS_EVT_DISCONNECT:
            Serial.printf("WebSocket client #%u disconnected\n", client->id());
            break;
        case WS_EVT_DATA:
            if (data[0] == '#') {
              char *token = strtok((char *)&data[2], " ");
              char * pEnd;
              messageNumber = (unsigned long)strtol(token,&pEnd, 10);
              token = strtok(NULL, " ");
              sampleInterval = (unsigned int)strtol(token,&pEnd, 10);

              if (numberOfSamples > MAX_NUMBER_OF_SAMPLES)
              {
                numberOfSamples = MAX_NUMBER_OF_SAMPLES;
              }
              sendBuffer();
            }
    else
    {
      Serial.printf("get Text: %s\n", data);
    }
    break;
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

void initWebSocket() {
    ws.onEvent(onEvent);
    server.addHandler(&ws);
}

void reportSD() {

  unsigned long totalMillis = millis(); // Get the elapsed time
  unsigned long seconds = totalMillis / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  unsigned long days  = hours / 24;

  // Use modulo to get the remainder for each unit
  seconds %= 60;
  minutes %= 60;
  hours   %= 24;

  File file = SD.open("/log.csv", FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open file for appending");
    return;
  }

  file.println("Power-down Event");
  file.print(days);
  file.print(" days, ");
  file.print(hours);
  file.print(" hours, ");
  file.print(minutes);
  file.print(" minutes, ");
  file.print(seconds);
  file.println(" seconds");

  Serial.print(days);
  Serial.print(" days, ");
  Serial.print(hours);
  Serial.print(" hours, ");
  Serial.print(minutes);
  Serial.print(" minutes, ");
  Serial.print(seconds);
  Serial.println(" seconds");

  for (int i = 0; i < sizeof(peakValues)/sizeof(peakValues[0]); i++) {
    sprintf(fileMessage, "%4u, %7u, ", i, (peakValues[i]) );
    file.print(fileMessage);
    file.println();
    Serial.print(fileMessage);
    Serial.println();
  }
  file.close();
}

void setup(void)
{
  Serial.begin(115200);
  Serial.println();
  Serial.println("Graphing Ammeter V1");
  pinMode(trigSensePin, INPUT_PULLUP);
  pinMode(monitorPin, OUTPUT);
  digitalWrite(monitorPin,LOW);

  LittleFS.begin();

  if (logging){
    if (!SD.begin()) {
      Serial.println("Card Mount Failed");
      //return;
      } else {
      Serial.println("Card Mount Succeeded");    
      }
  }


  Serial.print("Setting AP (Access Point)…");
  WiFi.softAP(ssid);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);


  initWebSocket();
  initWebServer();

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
    {
    Serial.println("Sending /index.html");
    request->send(LittleFS, "/index.html", "text/html", false);
    });
}

void loop(void)
{
  // server.handleClient();
  // webSocket.loop();
  analogSample();
  ws.cleanupClients();
}