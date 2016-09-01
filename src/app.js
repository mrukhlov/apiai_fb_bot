'use strict';

const apiai = require('apiai');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('node-uuid');
const request = require('request');
const JSONbig = require('json-bigint');
const async = require('async');

const REST_PORT = (process.env.PORT || 5000);
const APIAI_ACCESS_TOKEN = process.env.APIAI_ACCESS_TOKEN;
const APIAI_LANG = process.env.APIAI_LANG || 'en';
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

const apiAiService = apiai(APIAI_ACCESS_TOKEN, {language: APIAI_LANG, requestSource: "fb"});
const sessionIds = new Map();

function processEvent(event) {
    var sender = event.sender.id.toString();

    if ((event.message && event.message.text) || (event.postback && event.postback.payload)) {
        var text = event.message ? event.message.text : event.postback.payload;
        // Handle a text message from this sender

        if (!sessionIds.has(sender)) {
            sessionIds.set(sender, uuid.v1());
        }

        console.log("Text", text);

        let apiaiRequest = apiAiService.textRequest(text,
            {
                sessionId: sessionIds.get(sender)
            });

        apiaiRequest.on('response', (response) => {
            if (isDefined(response.result)) {
                //asd
                let responseText = response.result.fulfillment.speech;
                let responseData = response.result.fulfillment.data;
                let action = response.result.action;
                /*console.log(responseText);
                console.log(responseData);
                console.log(action);*/
                if (isDefined(responseData) && isDefined(responseData.facebook)) {
                    if (!Array.isArray(responseData.facebook)) {
                        try {
                            console.log('Response as formatted message');
                            sendFBMessage(sender, responseData.facebook);
                        } catch (err) {
                            sendFBMessage(sender, {text: err.message});
                        }
                    } else {
                        responseData.facebook.forEach((facebookMessage) => {
                            try {
                                if (facebookMessage.sender_action) {
                                    console.log('Response as sender action');
                                    sendFBSenderAction(sender, facebookMessage.sender_action);
                                }
                                else {
                                    console.log('Response as formatted message');
                                    sendFBMessage(sender, facebookMessage);
                                }
                            } catch (err) {
                                sendFBMessage(sender, {text: err.message});
                            }
                        });
                    }
                //} else if (isDefined(responseText)) {
                } else if (isDefined(action) && isDefined(responseText)) {
                    console.log('Response as text message');
                    // facebook API limit for text length is 320,
                    // so we must split message if needed
                    var splittedText = splitResponse(responseText);
                    /*switch (action){
                        case 'show_prod':
                            console.log('generic');
                            async.eachSeries(splittedText, (textPart, callback) => {
                                sendFBMessage(sender, {text: textPart}, callback);
                            });
                            sendFBMessage(sender, generic_message, null);
                            break;
                        default:
                            console.log('default');
                            async.eachSeries(splittedText, (textPart, callback) => {
                                sendFBMessage(sender, {text: textPart}, callback);
                            });
                    }*/
                    async.eachSeries(splittedText, (textPart, callback) => {
                        sendFBMessage(sender, {text: textPart}, callback);
                    });
                }

            }
        });

        apiaiRequest.on('error', (error) => console.error(error));
        apiaiRequest.end();
    }
}

function splitResponse(str) {
    if (str.length <= 320) {
        return [str];
    }

    return chunkString(str, 300);
}

function chunkString(s, len) {
    var curr = len, prev = 0;

    var output = [];

    while (s[curr]) {
        if (s[curr++] == ' ') {
            output.push(s.substring(prev, curr));
            prev = curr;
            curr += len;
        }
        else {
            var currReverse = curr;
            do {
                if (s.substring(currReverse - 1, currReverse) == ' ') {
                    output.push(s.substring(prev, currReverse));
                    prev = currReverse;
                    curr = currReverse + len;
                    break;
                }
                currReverse--;
            } while (currReverse > prev)
        }
    }
    output.push(s.substr(prev));
    //console.log(output);
    //output = ['Length of param message[text] must be less than or equal to 320'];
    return output;
}

/*const generic_message = {
    attachment: {
        type: "template",
        payload: {
            template_type: "generic",
            elements: [{
                title: "rift",
                subtitle: "Next-generation virtual reality",
                item_url: "https://www.oculus.com/en-us/rift/",
                image_url: "http://messengerdemo.parseapp.com/img/rift.png",
                buttons: [{
                    type: "web_url",
                    url: "https://www.oculus.com/en-us/rift/",
                    title: "Open Web URL"
                }, {
                    type: "postback",
                    title: "Call Postback",
                    payload: "Payload for first bubble"
                }]
            }, {
                title: "touch",
                subtitle: "Your Hands, Now in VR",
                item_url: "https://www.oculus.com/en-us/touch/",
                image_url: "http://messengerdemo.parseapp.com/img/touch.png",
                buttons: [{
                    type: "web_url",
                    url: "https://www.oculus.com/en-us/touch/",
                    title: "Open Web URL"
                }, {
                    type: "postback",
                    title: "Call Postback",
                    payload: "Payload for second bubble"
                }]
            }]
        }
    }
};*/

function sendFBMessage(sender, messageData, callback) {
    //console.log(sender);
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: FB_PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: sender},
            message: messageData
            //message: generic_message
        }
    }, (error, response, body) => {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }

        if (callback) {
            callback();
        }
    });
}

function sendFBSenderAction(sender, action, callback) {
    setTimeout(() => {
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: FB_PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: sender},
                sender_action: action
            }
        }, (error, response, body) => {
            if (error) {
                console.log('Error sending action: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
            if (callback) {
                callback();
            }
        });
    }, 1000);
}

function doSubscribeRequest() {
    request({
            method: 'POST',
            uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + FB_PAGE_ACCESS_TOKEN
        },
        (error, response, body) => {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

const app = express();

app.use(bodyParser.text({type: 'application/json'}));

app.get('/webhook/', (req, res) => {
    if (req.query['hub.verify_token'] == FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);

        setTimeout(() => {
            doSubscribeRequest();
        }, 3000);
    } else {
        res.send('Error, wrong validation token');
    }
});

app.post('/webhook/', (req, res) => {
    try {
        var data = JSONbig.parse(req.body);
        var asd = data;
        //console.log(asd);
        if (data.entry) {
            let entries = data.entry;
            entries.forEach((entry) => {
                let messaging_events = entry.messaging;
                if (messaging_events) {
                    messaging_events.forEach((event) => {
                        //console.log(event);
                        if (event.message && !event.message.is_echo ||
                            event.postback && event.postback.payload) {
                            processEvent(event);
                        }
                    });
                }
            });
        }

        return res.status(200).json({
            status: "ok"
        });
    } catch (err) {
        return res.status(400).json({
            status: "error",
            error: err
        });
    }

});

app.post('/webhook_apiai/', (req, res) => {

    //var weather_query = new Boolean(false);
    var weather_query = 'false';

    const generic_message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                elements: [{
                    title: "Fresh Pizza",
                    subtitle: "Be carefull and don't eat your fingers!!!",
                    item_url: "https://en.wikipedia.org/wiki/Pizza",
                    //image_url: "http://www.cbc.ca/inthekitchen/assets_c/2012/11/MargheritaPizza21-thumb-596x350-247022.jpg",
                    buttons: [{
                        type: "web_url",
                        url: "https://en.wikipedia.org/wiki/Pizza",
                        title: "Open Web URL"
                    }/*, {
                     type: "postback",
                     title: "Call Postback",
                     payload: "Payload for first bubble"
                     }*/]
                }]
            }
        }
    };

    try {
        var data = JSONbig.parse(req.body);
        //console.log(data);
        switch(data.result.action){
            case 'show_prod':
                console.log('pizza');
                switch(data.result.parameters.pizza_type){
                    case 'Margherita':
                        generic_message.attachment.payload.elements[0].title = data.result.parameters.pizza_type;
                        generic_message.attachment.payload.elements[0].image_url = "http://www.cbc.ca/inthekitchen/assets_c/2012/11/MargheritaPizza21-thumb-596x350-247022.jpg";
                }
                break;
            case 'show_weather':
                console.log('weather');
                weather_query = 'true';
                if(isDefined(data.result.parameters['geo-city']) == true){
                    var city = data.result.parameters['geo-city'];
                    var base_url = "https://query.yahooapis.com/v1/public/yql?" + "q=select+%2A+from+weather.forecast+where+woeid+in+%28select+woeid+from+geo.places%281%29+where+text%3D%27"+city+"%27%29" + "&format=json";
                    request({
                        url: base_url,
                        method: 'GET'
                    }, function(error, response, body){
                        if(error) {
                            console.log(error);
                            return res.status(400).json({
                                status: "error",
                                error: err
                            });
                        } else {
                            var query = JSON.parse(body).query;
                            var results = query.results;
                            var channel = results.channel;
                            var item = channel.item;
                            var location = channel.location;
                            var units = channel.units;
                            var condition = item.condition;
                            //console.log(channel)
                            var string = "Today in " + location.city + ": " + condition.text + ", the temperature is " + condition.temp + " " + units.temperature
                            generic_message.attachment.payload.elements[0].title = 'Weather in' + city;
                            generic_message.attachment.payload.elements[0].subtitle = string;
                            generic_message.attachment.payload.elements[0].item_url = channel.link;
                            generic_message.attachment.payload.elements[0].image_url = channel.image.url;
                            generic_message.attachment.payload.elements[0].buttons[0].url = channel.link;
                            return res.status(200).json({
                                data: {
                                    facebook: generic_message
                                }
                            });
                        }
                    });
                } else {
                    return res.status(200).json({
                        data: {
                            facebook: {text: 'no city'}
                        }
                    })}
                weather_query = 'false';
                break;
        }
        console.log(weather_query);
        if (weather_query != 'true'){
            return res.status(200).json({
                data: {
                    facebook: generic_message
                }
            })
        } else {
            return res.status(200).json({
                data: {
                    facebook: {text: 'error'}
                }
            })}
    } catch (err) {
        return res.status(400).json({
            status: "error",
            error: err
        });
    }
});

app.listen(REST_PORT, () => {
    console.log('Rest service ready on port ' + REST_PORT);
});

doSubscribeRequest();
