var workerManager = function(settings){
	settings=settings||{};
	var thiz=this;
	var functions = settings.functions||[];
	var activeCalls=[];
	var queuedCalls=[];
	var workers=[];
	var numWorkers = settings.numWorkers||4;
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
		worker.activeTasks=0;
		workers.push(worker);
		return worker;
	}
	var getFreeWorker = function(){
		var minTasks=-1;
		var minTasksId=0;
		for(var i=0;workers[i];i++){
			if(workers[i].activeTasks==0){
				return workers[i];
			}else if(workers[i].activeTasks<minTasks || minTasks<0){
				minTasks=workers[i].activeTasks;
				minTasksId=i;
			}
		}
		return;
		return workers[minTasksId];
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
		//Search next less busy worker
		var freeWorker=getFreeWorker();
		if(freeWorker){
			assignTaskToWorker(freeWorker, task);
			unqueueTasks();
		}else{
			//Save the call with the random identifier
			queuedCalls.push(task);
		}
	}
	var assignTaskToWorker = function(worker, task){
		//Save the task with the random identifier
		activeCalls[task.callbackHash] = task;
		worker.activeTasks++;
		console.log("Init task "+task.callbackHash+" to function "+task.name+" from worker num "+worker.count);
		worker.postMessage(JSON.stringify(task));
	}
	var unqueueTasks = function(){
		while(queuedCalls[0]){
			var freeWorker=getFreeWorker();
			if(freeWorker){
				assignTaskToWorker(freeWorker, queuedCalls.pop());
			}else{
				break;
			}
		}
	}
	var callbackWorker = function(worker,e){
		worker.activeTasks--;
		unqueueTasks();
		var call = activeCalls[e.callbackHash];
		console.log("Return call "+call.callbackHash+" to function "+call.name+" from worker num "+worker.count);
		e.timestamp = new Date();
		call.callback({result:e,call:call});
		delete activeCalls[e.callbackHash];
	}
	for(var i=0;i<numWorkers;i++){
		addWorker();
	}
	
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