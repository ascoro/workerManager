/*! workerManager - v0.1.0 - 2013-07-14
* Copyright (c) 2013 Albert Serra; Licensed  */
var workerManager = function(settings){
	settings=settings||{};
	var thiz=this;
	var functions = settings.functions||[];
	var activeWork=[];
	var workers=[];
	var generateBlob = function(functions){
		var num=functions.length;
		var code="";
		for(var i=0;i<num;i++){
			var f =functions[i];
			code+='case "'+f.name+'":'+f.code+';break;'
		}
		return URL.createObjectURL(new window.Blob(["self.addEventListener('message', function(e) { var o = JSON.parse(e.data);var params = o.params; var result={success:true}; switch(o.name){"+code+"default:result={success:false,message:'Not implemented'};break;}; result.callbackHash=o.callbackHash;self.postMessage(JSON.stringify(result)); }, false);"]));
	}
	var createWorker = function(){
		return new Worker(generateBlob(functions));
	}
	var addWorker = function(callback){
		var worker = createWorker();
		worker.addEventListener('message', function(e) { callbackWorker(this,JSON.parse(e.data)); }, false);
		worker.count=workers.length;
		workers.push(worker);
		return worker;
	}
	thiz.execute=function(name, params,callback){
		var rand = Math.floor(Math.random()*100000000000);
		var o={name:name,params:params,callbackHash:rand,timestamp:new Date()};
		activeWork[rand] = {o:o,callback:callback};
		workers[0].postMessage(JSON.stringify(o));
	}
	var callbackWorker = function(worker,e){
		var active = activeWork[e.callbackHash];
		e.timestamp = new Date();
		active.callback({result:e,call:active.o});
		delete activeWork[e.callbackHash];
	}
	var worker = addWorker();
};