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

app.post('/webhook_apiai/', (req, res) => {

    //var weather_query = new Boolean(false);
    var weather_query = false;

    const generic_message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                elements: []
            }
        }
    };

    var HAWAIIAN_CHICKEN = {
        title: "HAWAIIAN CHICKEN",
        subtitle: "Chicken meat, juicy pineapples and Mozzarella cheese on tomato pizza sauce.",
        item_url: "https://en.wikipedia.org/wiki/Pizza",
        image_url: "http://www.phdelivery.com.my/i/menu/pizza/pizza_hawaiianchicken.jpg",
        buttons: [/*{
         type: "web_url",
         url: "https://en.wikipedia.org/wiki/Pizza",
         title: "Open Web URL"
         },*/ {
            type: "postback",
            title: "Show HAWAIIAN CHICKEN",
            payload: "HAWAIIAN CHICKEN"
        }]
    };
    var CHICKEN_PEPPERONI = {
        title: "CHICKEN PEPPERONI",
        subtitle: "Chicken pepperoni topped with mozzarella cheese and tomato pizza sauce.",
        item_url: "https://en.wikipedia.org/wiki/Pizza",
        image_url: "http://www.phdelivery.com.my/i/menu/pizza/pizza_chickenpepperoni.jpg",
        buttons: [/*{
         type: "web_url",
         url: "https://en.wikipedia.org/wiki/Pizza",
         title: "Open Web URL"
         },*/ {
            type: "postback",
            title: "Show CHICKEN PEPPERONI",
            payload: "CHICKEN PEPPERONI"
        }]
    };
    var TROPICAL_CHICKEN = {
        title: "TROPICAL CHICKEN",
        subtitle: "Sliced chicken rolls and pineapples accompanied by tomato pizza sauce.",
        item_url: "https://en.wikipedia.org/wiki/Pizza",
        image_url: "http://www.phdelivery.com.my/i/menu/pizza/pizza_tropicalchicken.jpg",
        buttons: [/*{
         type: "web_url",
         url: "https://en.wikipedia.org/wiki/Pizza",
         title: "Open Web URL"
         },*/ {
            type: "postback",
            title: "Show TROPICAL CHICKEN",
            payload: "TROPICAL CHICKEN"
        }]
    };
    var SPICY_TUNA = {
        title: "SPICY TUNA",
        subtitle: "Tuna and onion on a sambal sauce.",
        item_url: "https://en.wikipedia.org/wiki/Pizza",
        image_url: "http://www.phdelivery.com.my/i/menu/pizza/pizza_spicytuna.jpg",
        buttons: [/*{
         type: "web_url",
         url: "https://en.wikipedia.org/wiki/Pizza",
         title: "Open Web URL"
         },*/ {
            type: "postback",
            title: "Show SPICY TUNA",
            payload: "SPICY TUNA"
        }]
    };

    try {
        var data = JSONbig.parse(req.body);
        //console.log(data);
        switch(data.result.action){
            case 'show_pizza':
                console.log('pizza');
                if(isDefined(data.result.parameters['pizza_type']) == true){
                    switch(data.result.parameters.pizza_type){
                        case 'Margherita':
                            generic_message.attachment.payload.elements[0].title = data.result.parameters.pizza_type;
                            generic_message.attachment.payload.elements[0].image_url = "http://www.cbc.ca/inthekitchen/assets_c/2012/11/MargheritaPizza21-thumb-596x350-247022.jpg";
                            break;
                        case 'HAWAIIAN CHICKEN':
                            generic_message.attachment.payload.elements = [];
                            generic_message.attachment.payload.elements.push(HAWAIIAN_CHICKEN);
                            generic_message.attachment.payload.elements[0].buttons[0].title = 'Go back';
                            generic_message.attachment.payload.elements[0].buttons[0].payload = 'pizza';
                            break;
                        case 'CHICKEN PEPPERONI':
                            generic_message.attachment.payload.elements = [];
                            generic_message.attachment.payload.elements.push(CHICKEN_PEPPERONI);
                            generic_message.attachment.payload.elements[0].buttons[0].title = 'Go back';
                            generic_message.attachment.payload.elements[0].buttons[0].payload = 'pizza';
                            break;
                        case 'TROPICAL CHICKEN':
                            generic_message.attachment.payload.elements = [];
                            generic_message.attachment.payload.elements.push(TROPICAL_CHICKEN);
                            generic_message.attachment.payload.elements[0].buttons[0].title = 'Go back';
                            generic_message.attachment.payload.elements[0].buttons[0].payload = 'pizza';
                            break;
                        case 'SPICY TUNA':
                            generic_message.attachment.payload.elements = [];
                            generic_message.attachment.payload.elements.push(SPICY_TUNA);
                            generic_message.attachment.payload.elements[0].buttons[0].title = 'Go back';
                            generic_message.attachment.payload.elements[0].buttons[0].payload = 'pizza';
                            break;
                    }
                } else {
                    generic_message.attachment.payload.elements.push(HAWAIIAN_CHICKEN, CHICKEN_PEPPERONI, TROPICAL_CHICKEN, SPICY_TUNA);
                }
            break;
            case 'show_weather':
                console.log('weather');

                if(isDefined(data.result.parameters['geo-city']) == true || isDefined(data.result.contexts.parameters['geo-city']) == true){
                    if (isDefined(data.result.parameters['geo-city']) == true) {
                        var city = data.result.parameters['geo-city'];
                    } else {
                        var city = data.result.parameters.contexts['geo-city'];
                    }
                    var base_url = "https://query.yahooapis.com/v1/public/yql?" + "q=select+%2A+from+weather.forecast+where+woeid+in+%28select+woeid+from+geo.places%281%29+where+text%3D%27"+city+"%27%29" + "&format=json";
                    weather_query = true;
                    request({
                        url: base_url,
                        method: 'GET',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        contentType :'application/x-www-form-urlencoded',
                    }, function(error, response, body){
                        if(error) {
                            console.log(error);
                            return res.status(400).json({
                                status: "error",
                                error: error
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
                    });
                }
            break;
        }
        console.log(weather_query);
        if (weather_query != true) {
            return res.status(200).json({
                data: {
                    facebook: generic_message
                }
            });
        }
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