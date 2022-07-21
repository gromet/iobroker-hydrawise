class hydrawise {
    constructor(token,object_path) {
        this.token = token;
        this.object_path = object_path;
        this.customer_url = `https://app.hydrawise.com/api/v1/customerdetails.php?api_key=${this.token}`;
        this.status_url = `https://app.hydrawise.com/api/v1/statusschedule.php?api_key=${this.token}`;
        this.set_url = `https://api.hydrawise.com/api/v1/setzone.php?api_key=${this.token}`;
        this.CONSTANTS = {
            object_name: 'hydrawise', // todo ändern in hydrawise
            default_run_time: 30, // in sec
            date_format: 'de-DE',
            day_conversion: {
                Mon: 'Montag',
                Tue: 'Dienstag',
                Wed: 'Mittwoch',
                Thu: 'Donnerstag',
                Fri: 'Freitag',
                Sat: 'Samstag',
                Sun: 'sonntag',
            },
        };
    }

    async getRelays(){
       const status_response = await new Promise((resolve,reject) => {
            request({url : this.status_url}, function (error, response, body) {
                if(response.statusCode === 200){
                    resolve(JSON.parse(body));
                }
                else{
                    console.log(error);
                    reject(false);
                }
            });
        }); 

        if(!status_response){
            log('API error','error');
        }

        if(status_response.hasOwnProperty('nextpoll')){
            this.objCreateSet(`next_poll`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'make your next request'}},status_response.nextpoll);
        }
        await this.objCreateSet(`message`,{type: "state", common: {type: 'string', role: 'info.display', read: true, name: 'api response'}},'');
        // Start - Run all zones for a period of time
        await this.objCreateSet(`start_all`,{type: "state", common: {type: 'boolean', role: 'button.start', read: true, write: true, name: 'Run all zones for a period of time'}});
        await this.objCreateSet(`start_all_zones_for`,{type: "state", common: {type: 'number', role: 'value', unit: 'sec', read: true, write: true, name: 'Number of seconds to run all zone for'}},this.CONSTANTS.default_run_time);
        // Stop - Stop all zones for a period of time
        await this.objCreateSet(`stop_all`,{type: "state", common: {type: 'boolean', role: 'button.stop', read: true, write: true, name: 'Stop all zones'}});
        // Start - Run zone for a period of time
        await this.objCreateSet(`suspend_all`,{type: "state", common: {type: 'boolean', role: 'button.pause', read: true, write: true, name: 'Suspend all zones for a period of time'}});
        await this.objCreateSet(`suspend_all_zones_for`,{type: "state", common: {type: 'number', role: 'value', unit: 'sec', read: true, write: true, name: 'Number of seconds to suspend zone for'}},this.CONSTANTS.default_run_time);

        const current_controller = await getStateAsync(`${this.object_path}.${this.CONSTANTS.object_name}.current_controller`);
        let controller_device_path = getIdByName(current_controller.val,true)[0].replace(`${this.object_path}.${this.CONSTANTS.object_name}.`,'');
        if(!controller_device_path){
            controller_device_path = `controller_0`; // api can only handle one controller....so..
        }
        
        if(status_response.hasOwnProperty('relays') && status_response.relays.length){
            for(let i = 0; i < status_response.relays.length; i++){
                const extra_obj_path = `${controller_device_path}.relay_${i}`
                this.objCreateSet(extra_obj_path,{type: "device", common: { "name": `${status_response.relays[i].name}`, "type": "controller"}});

                // Zone name
                if(status_response.relays[i].hasOwnProperty('name')){
                    this.objCreateSet(`${extra_obj_path}.name`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'Zone name'}},status_response.relays[i].name);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): relays.[${i}].name nicht verfügbar`,'warn');
                }

                // Physical zone number
                if(status_response.relays[i].hasOwnProperty('relay')){
                    this.objCreateSet(`${extra_obj_path}.relay`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Physical zone number'}},status_response.relays[i].relay);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): relays.[${i}].relay nicht verfügbar`,'warn');
                }

                // Length of next run time
                if(status_response.relays[i].hasOwnProperty('run')){
                    this.objCreateSet(`${extra_obj_path}.run`,{type: "state", common: {type: 'number', role: 'level.timer', unit:'sec', read: true, name: 'Length of next run time'}},status_response.relays[i].run);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): relays.[${i}].run nicht verfügbar`,'warn');
                }

                // Unique ID for this zone
                if(status_response.relays[i].hasOwnProperty('relay_id')){
                    this.objCreateSet(`${extra_obj_path}.relay_id`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Unique ID for this zone'}},status_response.relays[i].relay_id);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): relays.[${i}].relay_id nicht verfügbar`,'warn');
                }

                // Number of seconds until the next programmed run
                if(status_response.relays[i].hasOwnProperty('time')){
                    this.objCreateSet(`${extra_obj_path}.time`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Number of seconds until the next programmed run'}},status_response.relays[i].time);
                    let time_string = '';
                    if (status_response.relays[i].time<500000)
                    {
                        let b = new Date().getTime() ;
                        b = b + status_response.relays[i].time * 1000;
                        time_string = formatDate(b, 'DD.MM. hh:mm');
                    }
                    this.objCreateSet(`${extra_obj_path}.time_text`,{type: "state", common: {type: 'string', role: 'date.start', read: true, name: 'Startzeit'}},time_string);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): relays.[${i}].time nicht verfügbar`,'warn');
                }

                // Next time this zone will water
                if(status_response.relays[i].hasOwnProperty('timestr')){
                    this.objCreateSet(`${extra_obj_path}.timestr`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'Next time this zone will water'}},status_response.relays[i].timestr);
                    this.objCreateSet(`${extra_obj_path}.timestr_de`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'DE Next time this zone will water'}},this.CONSTANTS.day_conversion[status_response.relays[i].timestr]);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): relays.[${i}].timestr nicht verfügbar`,'warn');
                }

                // # Buttons anlegen
                // Start - Run zone for a period of time
                await this.objCreateSet(`${extra_obj_path}.start`,{type: "state", common: {type: 'boolean', role: 'button.start', read: true, write: true, name: 'Run zone for a period of time'}});
                await this.objCreateSet(`${extra_obj_path}.start_zone_for`,{type: "state", common: {type: 'number', role: 'value', unit: 'sec', read: true, write: true, name: 'Number of seconds to run zone for'}},this.CONSTANTS.default_run_time);
                
                // Stop - Stop zone for a period of time
                await this.objCreateSet(`${extra_obj_path}.stop`,{type: "state", common: {type: 'boolean', role: 'button.stop', read: true, write: true, name: 'stop zone'}});

                // Suspend - Suspend zone for a period of time
                await this.objCreateSet(`${extra_obj_path}.suspend`,{type: "state", common: {type: 'boolean', role: 'button.pause', read: true, write: true, name: 'Suspend zone for a period of time'}});
                await this.objCreateSet(`${extra_obj_path}.suspend_zone_for`,{type: "state", common: {type: 'number', role: 'value', unit: 'sec', read: true, write: true, name: 'Number of seconds to suspend zone for'}},this.CONSTANTS.default_run_time);
                

            }
        }
        // List of configured sensors for the current active controller 
        if(status_response.hasOwnProperty('sensors') && status_response.sensors.length){
            for(let i = 0; i < status_response.sensors.length; i++){
                const extra_obj_path = `${controller_device_path}.sensor_${i}`;
                this.objCreateSet(extra_obj_path,{type: "device", common: { "name": `sensor_${[i]}`, "type": "controller"}});

                // Input number 
                if(status_response.sensors[i].hasOwnProperty('input')){
                    this.objCreateSet(`${extra_obj_path}.input`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Unique ID for this zone'}},status_response.sensors[i].input);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): sensors.[${i}].input nicht verfügbar`,'warn');
                }

                // Type of sensor 
                if(status_response.sensors[i].hasOwnProperty('type')){
                    this.objCreateSet(`${extra_obj_path}.type`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Type of sensor'}},status_response.sensors[i].type);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): sensors.[${i}].type nicht verfügbar`,'warn');
                }

                // Sensor mode
                if(status_response.sensors[i].hasOwnProperty('mode')){
                    this.objCreateSet(`${extra_obj_path}.mode`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Sensor mode'}},status_response.sensors[i].mode);
                }
                else{
                    log(`${this.CONSTANTS.object_name}(): sensors.[${i}].mode nicht verfügbar`,'warn');
                }
            }
        }
    }

    async setbuttonEvents(){
            // this hat in einer unterfunktion anderes origin
            const base_path = `${this.object_path}.${this.CONSTANTS.object_name}`
            const set_url = this.set_url;
            // START Buttons mit Funktion belegen
            on({id: `${base_path}.start_all`, change: 'any'}, async function(){
                let run_zones_for = (await getStateAsync(`${base_path}.start_all_zones_for`));
                const response = await new Promise((resolve,reject) => {
                    request({url : `${set_url}&action=runall&period_id=999&custom=${run_zones_for.val}`}, function (error, response, body) {
                        if(response.statusCode === 200){
                            resolve(JSON.parse(body));
                        }
                        else{
                            console.log(error);
                            reject(false);
                        }
                    });
                }); 
                if(response.hasOwnProperty('message')){
                    log(response.message);
                    await setStateAsync(`${base_path}.message`,response.message);
                }
                else{
                    await setStateAsync(`${base_path}.message`,'');
                }
            });
            $(`state[id=${this.object_path}.${this.CONSTANTS.object_name}.controller*.relay_*.start]`).each(function(id, i) {
                const obj_path = id.replace('.start','');
                on({id: `${id}`, change: 'any'}, async function(){
                    let relay_id = (await getStateAsync(`${obj_path}.relay_id`));
                    let run_zone_for = (await getStateAsync(`${obj_path}.start_zone_for`));

                    const response = await new Promise((resolve,reject) => {
                        request({url : `${set_url}&action=run&period_id=999&relay_id=${relay_id.val}&custom=${run_zone_for.val}`}, function (error, response, body) {
                            if(response.statusCode === 200){
                                resolve(JSON.parse(body));
                            }
                            else{
                                console.log(error);
                                reject(false);
                            }
                        });
                    }); 
                    if(response.hasOwnProperty('message')){
                        log(response.message);
                        await setStateAsync(`${base_path}.message`,response.message);
                    }
                    else{
                        await setStateAsync(`${base_path}.message`,'');
                    }
                })
            });
            
            // STOP Buttons mit Funktion belegen
            on({id: `${base_path}.stop_all`, change: 'any'}, async function(){
                    const response = await new Promise((resolve,reject) => {
                        request({url : `${set_url}&action=stopall`}, function (error, response, body) {
                            if(response.statusCode === 200){
                                resolve(JSON.parse(body));
                            }
                            else{
                                console.log(error);
                                reject(false);
                            }
                        });
                    }); 
                    if(response.hasOwnProperty('message')){
                        log(response.message);
                        await setStateAsync(`${base_path}.message`,response.message);
                    }
                    else{
                        await setStateAsync(`${base_path}.message`,'');
                    }
                })
            $(`state[id=${this.object_path}.${this.CONSTANTS.object_name}.controller*.relay_*.stop]`).each(function(id, i) {
                const obj_path = id.replace('.stop','');
                on({id: `${obj_path}.stop`, change: 'any'}, async function(){
                    let relay_id = (await getStateAsync(`${obj_path}.relay_id`));

                    const response = await new Promise((resolve,reject) => {
                        request({url : `${set_url}&action=stop&relay_id=${relay_id.val}`}, function (error, response, body) {
                            if(response.statusCode === 200){
                                resolve(JSON.parse(body));
                            }
                            else{
                                console.log(error);
                                reject(false);
                            }
                        });
                    }); 
                    if(response.hasOwnProperty('message')){
                        log(response.message);
                        await setStateAsync(`${base_path}.message`,response.message);
                    }
                    else{
                        await setStateAsync(`${base_path}.message`,'');
                    }
                })
            });

            // Suspenf Buttons mit Funktion belegen
            on({id: `${base_path}.suspend_all`, change: 'any'}, async function(){
                let suspend_zones_for = (await getStateAsync(`${base_path}.suspend_all_zones_for`));
                const response = await new Promise((resolve,reject) => {
                    request({url : `${set_url}&action=suspendall&period_id=999&custom=${suspend_zones_for.val}`}, function (error, response, body) {
                        if(response.statusCode === 200){
                            resolve(JSON.parse(body));
                        }
                        else{
                            console.log(error);
                            reject(false);
                        }
                    });
                }); 
                if(response.hasOwnProperty('message')){
                    log(response.message);
                    await setStateAsync(`${base_path}.message`,response.message);
                }
                else{
                    await setStateAsync(`${base_path}.message`,'');
                }
            });
            $(`state[id=${this.object_path}.${this.CONSTANTS.object_name}.controller*.relay_*.suspend]`).each(function(id, i) {
                const obj_path = id.replace('.suspend','');
                on({id: `${id}`, change: 'any'}, async function(){
                    let relay_id = (await getStateAsync(`${obj_path}.relay_id`));
                    let suspend_zone_for = (await getStateAsync(`${obj_path}.suspend_zone_for`));

                    const response = await new Promise((resolve,reject) => {
                        request({url : `${set_url}&action=suspend&period_id=999&relay_id=${relay_id.val}&custom=${suspend_zone_for.val}`}, function (error, response, body) {
                            if(response.statusCode === 200){
                                resolve(JSON.parse(body));
                            }
                            else{
                                console.log(error);
                                reject(false);
                            }
                        });
                    }); 
                    if(response.hasOwnProperty('message')){
                        log(response.message);
                        await setStateAsync(`${base_path}.message`,response.message);
                    }
                    else{
                        await setStateAsync(`${base_path}.message`,'');
                    }
                })
            });
                
    }

    async getCustomer(){
        const customer_response = await new Promise((resolve,reject) => {
            request({url : this.customer_url}, function (error, response, body) {
                if(response.statusCode === 200){
                    resolve(JSON.parse(body));
                }
                else{
                    console.log(error);
                    reject(false);
                }
            });
        });
        if(customer_response){
            // Unique customer ID 
            if(customer_response.hasOwnProperty('customer_id')){
                this.objCreateSet('customer_id',{type: "state", common: {type: 'number', role: 'value', read: true, write: false, name: 'Unique customer ID '}},customer_response.customer_id);
            }
            else{
                log(`${this.CONSTANTS.object_name}(): customer_id nicht verfügbar`,'warn');
            }
            // Name of current active controller
            if(customer_response.hasOwnProperty('current_controller')){
                this.objCreateSet('current_controller',{type: "state", common: {type: 'string', role: 'value', read: true, write: false, name: 'Name of current active controller'}},customer_response.current_controller);
            }
            else{
                log(`${this.CONSTANTS.object_name}(): current_controller nicht verfügbar`,'warn');
            }
            // Unique ID of current active controller 
            if(customer_response.hasOwnProperty('controller_id')){
                this.objCreateSet('current_controller_id',{type: "state", common: {type: 'number', role: 'value', read: true, write: false, name: 'Unique ID of current active controller '}},customer_response.controller_id);
            }
            else{
                log(`${this.CONSTANTS.object_name}(): controller_id nicht verfügbar`,'warn');
            }

            //alle Controller anlegen
            if(customer_response.hasOwnProperty('controllers') && customer_response.controllers.length){
                for (let i = 0; i < customer_response.controllers.length; i++) 
                {
                    const extra_obj_path = `controller_${i}`;
                    this.objCreateSet(extra_obj_path,{type: "channel", common: { "name": `${customer_response.controllers[i].name}`, "type": "controller"}});
                    // Name of controller
                    if(customer_response.controllers[i].hasOwnProperty('name')){
                        this.objCreateSet(`${extra_obj_path}.name`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'Name of controller'}},customer_response.controllers[i].name);
                    }
                    else{
                        log(`${this.CONSTANTS.object_name}(): controllers[${i}].name nicht verfügbar`,'warn');
                    }
                    // Last time we contacted controller
                    if(customer_response.controllers[i].hasOwnProperty('last_contact')){
                        this.objCreateSet(`${extra_obj_path}.last_contact_ts`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Last time we contacted controller'}},customer_response.controllers[i].last_contact);
                        this.objCreateSet(`${extra_obj_path}.last_contact`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'Last time we contacted controller'}}, new Date(customer_response.controllers[i].last_contact * 1000).toLocaleString(this.CONSTANTS.date_format));
                    }
                    else{
                        log(`${this.CONSTANTS.object_name}(): controllers[${i}].last_contact nicht verfügbar`,'warn');
                    }
                    // Serial number of controller 
                    if(customer_response.controllers[i].hasOwnProperty('serial_number')){
                        this.objCreateSet(`${extra_obj_path}.serial_number`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'Serial number of controller'}},customer_response.controllers[i].serial_number);
                    }
                    else{
                        log(`${this.CONSTANTS.object_name}(): controllers[${i}].serial_number nicht verfügbar`,'warn');
                    }
                    // Unique ID of controller
                    if(customer_response.controllers[i].hasOwnProperty('controller_id')){
                        this.objCreateSet(`${extra_obj_path}.id`,{type: "state", common: {type: 'number', role: 'value', read: true, name: 'Unique ID of controller'}},customer_response.controllers[i].controller_id);
                    }
                    else{
                        log(`${this.CONSTANTS.object_name}(): controllers[${i}].controller_id nicht verfügbar`,'warn');
                    }
                    // Controller status
                    if(customer_response.controllers[i].hasOwnProperty('status')){
                        this.objCreateSet(`${extra_obj_path}.status`,{type: "state", common: {type: 'string', role: 'value', read: true, name: 'Controller status'}},customer_response.controllers[i].status);
                    }
                    else{
                        log(`${this.CONSTANTS.object_name}(): controllers[${i}].status nicht verfügbar`,'warn');
                    }
                   
                }
            }
            else{
                log(`${this.CONSTANTS.object_name}(): controllers nicht verfügbar`,'warn');
            }

 


            //-----------
        }
    }

    /**
     * Wenn Object nicht existiert, wird es erstellt
     * Falls Object ein state ist, kann es gesetzt werden
     * 
     * @param {string}  id
     * @param {object}  obj
     * @param {*}   state
     */
    async objCreateSet(id,obj,state){
        if(!id){
            return false;
        }
        id = `${this.object_path}.${this.CONSTANTS.object_name}.${id}`; 
        const exist = await existsObjectAsync(id);
        if(!exist && obj){
            await setObjectAsync(id,obj);
        }
        if(obj && obj.hasOwnProperty('type') && obj.type === 'state' && state){
            let l = await setStateAsync(id,state,true);
            console.log(l);
        }
        return true;
    }
}

// Start Script
const hydra = new hydrawise('<your-token>','0_userdata.0');
hydra.getCustomer(); // um objekte anzulegen und zu aktualisieren
hydra.getRelays(); // um objekte anzulegen und zu aktualisieren
hydra.setbuttonEvents(); // Buttons mit Events anlegen - only once

schedule('*/10 * * * *', function(){
    hydra.getCustomer(); // um objekte anzulegen und zu aktualisieren
    hydra.getRelays(); // um objekte anzulegen und zu aktualisieren
});
