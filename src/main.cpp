/* V1
  This application samples the analog inputs and one GPIO of the ESP32
  and transmits the data via websockets for display in a web browser

  The web sockets messaging scheme is based on this project:

  Repository: https://github.com/krzychb/EspScopeA0
  Author: krzychb at gazeta.pl

*/

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include <WiFiManager.h>  //needs to be included before ESPAsyncWebServer.h
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>


#define trigSensePin  23  // low = Trigger Active
#define HTTP_PORT 80
#define ADC0 32
#define ADC1 33
#define ADC2 34
#define ADC3 35
#define ADC4 36

const char* ssid  = "ESP32-Access-Point";

AsyncWebServer server(HTTP_PORT);
AsyncWebSocket ws("/ws");

//
// Continuous sampling rate of A0 in this application is about 12 samples/ms
// Wi-Fi connection gets stuck if continuous A0 sampling is longer than 60ms
// Therefore maximum of 720 samples can be made
//
#define MAX_NUMBER_OF_SAMPLES 100 // size of circular ADC buffer
unsigned int samples[5][MAX_NUMBER_OF_SAMPLES];
unsigned int timeStamps[MAX_NUMBER_OF_SAMPLES];
unsigned int TrigFlags[MAX_NUMBER_OF_SAMPLES];
unsigned int numberOfSamples = MAX_NUMBER_OF_SAMPLES;
unsigned int currentSample = 0;
unsigned int lastXmitSample = 0;
unsigned int sampleInterval = 10;
unsigned long millisLastSample = 0;
unsigned long messageNumber = 0;

void initWebServer() {
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
    server.begin();
    Serial.println("HTTP server started");
}

void sendBuffer() {
  unsigned int samplesToXmit = 0;
  String message = "# ";

  if (currentSample == lastXmitSample)
  {
    message = message + String(messageNumber) + " -";
    // message[message.length() - 1] = '\0';
    message[message.length()] = '\0';
    //webSocket.sendTXT(socketNumber, message);
    ws.textAll(message);
  }
  else
  {
    if (currentSample < lastXmitSample)
    { // check for buffer wrap
      samplesToXmit = (numberOfSamples - lastXmitSample + currentSample);
    }
    else
    {
      samplesToXmit = (currentSample - lastXmitSample);
    }
    message = message + String(messageNumber) + " ";
    // for (unsigned int i = 0; i < numberOfSamples; i++)
    for (unsigned int i = 0; i < samplesToXmit; i++)
    {
      if (++lastXmitSample >= numberOfSamples)
      {
        lastXmitSample = 0;
      }
      message = message + String(timeStamps[lastXmitSample]) 
      + "@" + String(samples[0][lastXmitSample]) 
      + "@" + String(samples[1][lastXmitSample]) 
      + "@" + String(samples[2][lastXmitSample]) 
      + "@" + String(samples[3][lastXmitSample]) 
      + "@" + String(samples[4][lastXmitSample]) 
      + "@" + String(TrigFlags[lastXmitSample]) 
      + ";";

    }
    message[message.length() - 1] = '\0';
    ws.textAll(message);
    //webSocket.sendTXT(socketNumber, message);
    // Serial.print("Socket message: [");
    // Serial.print(message);
    // Serial.println("]");
    // Serial.print("Samples collected: ");
    // Serial.println(samplesToXmit);

    // lastXmitSample = currentSample;
  }
}

void analogSample(void)
{
  unsigned long millisCurrent = millis();
  unsigned int millisDelta = millisCurrent - millisLastSample;
  if (millisDelta > sampleInterval)
  {
    millisLastSample = millisCurrent;
    currentSample += 1;
    if (currentSample >= numberOfSamples)
    {
      currentSample = 0;
    }
    timeStamps[currentSample] = millisDelta;    // timestamp = millis between last samples
    samples[0][currentSample] = analogRead(ADC0); // analog voltage data
    samples[1][currentSample] = analogRead(ADC1); // analog voltage data
    samples[2][currentSample] = analogRead(ADC2); // analog voltage data
    samples[3][currentSample] = analogRead(ADC3); // analog voltage data
    samples[4][currentSample] = analogRead(ADC4); // analog voltage data        
    TrigFlags[currentSample] = digitalRead(trigSensePin);
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

void setup(void)
{
  Serial.begin(115200);
  Serial.println();
  Serial.println("Graphing Ammeter V1");
  pinMode(trigSensePin, INPUT_PULLUP);

  LittleFS.begin();

  // WiFiManager wifiManager;
  // wifiManager.autoConnect("AutoConnectAP");

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

  Serial.print("Open http://");
  Serial.print(WiFi.localIP());
  Serial.println("/ to see the scope");
}

void loop(void)
{
  // server.handleClient();
  // webSocket.loop();
  analogSample();
  ws.cleanupClients();
}