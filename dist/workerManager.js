/*! workerManager - v0.1.0 - 2013-07-19
* Copyright (c) 2013 Albert Serra; Licensed  */
var workerManager = function(settings){
	settings=settings||{};
	var thiz=this;
	var functions = settings.functions||[];
	var queuedCalls=[];
	var workers=[];
	var numWorkers = settings.numWorkers||4;
	
	var addWorker = function(){
		var worker = new coroWorker({callback:unqueueTasks,functions:functions});
		worker.count=workers.length;
		workers.push(worker);
		return worker;
	}
	var getFreeWorker = function(){
		var minTasks=-1;
		var minTasksId=0;
		for(var i=0;workers[i];i++){
			var activeTasks=workers[i].activeTasks;
			if(activeTasks==0){
				return workers[i];
			}else if(activeTasks<minTasks || minTasks<0){
				minTasks=workers[i].activeTasks;
				minTasksId=i;
			}
		}
		return;
	}
	thiz.execute=function(name, params,callback){
		//Generate a random identifier
		var rand = Math.floor(Math.random()*100000000000);
		
		//Define the "call" object
		var call={
			name:name,
			params:params,
			callbackHash:rand,
			timestamp:new Date(),
			callback:callback,
		};
		
		//Assign new task to worker
		assignNewTaskToFreeWorker(call);
	}
	var assignNewTaskToFreeWorker = function(task){
		console.log("About to assign ");
		console.log(task);
		//Search next less busy worker
		var freeWorker=getFreeWorker();
		if(freeWorker){
			freeWorker.executeTask(task);
			console.log("Assigned");
			unqueueTasks();
		}else{
			//Save the call with the random identifier
			queuedCalls.push(task);
			console.log("Queued");
		}
	}
	var unqueueTasks = function(){
		while(queuedCalls[0]){
			var freeWorker=getFreeWorker();
			if(freeWorker){
				freeWorker.executeTask(queuedCalls.pop());
			}else{
				break;
			}
		}
	}
	var init = function(){
		for(var i=0;i<numWorkers;i++){
			addWorker();
		}
	};
	thiz.printStatistics = function(){
		for(var i=0;workers[i];i++){
			console.log(workers[i].getStatistics());
		}
	}
	
	var coroWorker = function(settings){
		var thiz=this;
		var webWorker;
		var functions = settings.functions;
		var activeCalls=[];
		thiz.activeTasks=0;
		thiz.timeSpend=0;
		thiz.totalTasks=0;
		thiz.getStatistics = function(){
			return "Worker "+thiz.count+" has processed "+thiz.totalTasks+" tasks in "+thiz.timeSpend+" milliseconds";
		}
		this.executeTask = function(task){		
			//Save the task with the random identifier
			activeCalls[task.callbackHash] = task;
			thiz.activeTasks++;
			thiz.totalTasks++;
			console.log("Init task "+task.callbackHash+" to function "+task.name+" from worker num "+thiz.count);
			webWorker.postMessage(JSON.stringify(task));
		}
		var generateBlob = function(functions){
			var num=functions.length;
			var code="";
			for(var i=0;i<num;i++){
				var f =functions[i];
				code+='case "'+f.name+'":'+f.code+';break;'
			}
			return URL.createObjectURL(new window.Blob(["self.addEventListener('message', function(e) { var o = JSON.parse(e.data);var params = o.params; var result={success:true}; switch(o.name){"+code+"default:result={success:false,message:'Not implemented'};break;}; result.callbackHash=o.callbackHash;self.postMessage(JSON.stringify(result)); }, false);"]));
		}
		var updateStatistics = function(task,result){
			var timeSpend = result.timestamp.getTime()-task.timestamp.getTime();
			thiz.timeSpend +=timeSpend;
		}
		var callbackWorker = function(result){
			result.timestamp = new Date();
			var task = activeCalls[result.callbackHash];
			delete activeCalls[result.callbackHash];
			updateStatistics(task,result);
			thiz.activeTasks--;
			console.log("Return task "+task.callbackHash+" to function "+task.name+" from worker num "+thiz.count);
			setTimeout(settings.callback,0); //Notify that is finished
			setTimeout(function(){task.callback({result:result,task:task});},0); //Call task callback
		}
		var init = function(){
			webWorker = new Worker(generateBlob(functions));
			webWorker.addEventListener('message', function(e) { callbackWorker(JSON.parse(e.data)); }, false);
		}
		
		init();
	}
	init();
	/**TODOS:
		Multiple Workers - Done
		Select the number of workers - Done
		Detect cores and automatically create as many workers
		Generate smart queues to store queued calls and asign when workers free.
		Create queues inside workers so we can pre-assign to the most likely to be next worker but in case another worker finish first we can remove the call from the first worker
		Statistics: % of running time per worker, most expensive functions
		Posibility to add or remove functions from initialized workers
		Use requirejs on worker to just evaluate the functions that we are about to use
		Implement pull request from worker for unkown functions
		....
	***/
};