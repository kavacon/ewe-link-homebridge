let Service, Characteristic;
const serviceMap = new Map();
const creationMap = new Map();

module.exports.configure = function(service, characteristic){
    Service = service;
    Characteristic = characteristic;
    fillMaps();
}

function fillMaps(){
    serviceMap.set("garage", Service.GarageDoorOpener);
    creationMap.set(Service.GarageDoorOpener, function(){});

    serviceMap.set("default", Service.Switch);
    creationMap.set(Service.Switch, function(){});
}