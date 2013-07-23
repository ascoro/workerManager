var workerManager = function(settings){
	settings=settings||{};
	var thiz=this;
	var functions = settings.functions||[];
	var queuedTaks=[];
	var workers=[];
	var numWorkers = settings.numWorkers||0;
	
	var addWorker = function(simulateWorker){
		var worker = new coroWorker({callback:unqueueTasks,functions:functions,simulateWorker:simulateWorker});
		worker.id=workers.length;
		workers.push(worker);
		return worker;
	}
	var getFreeWorker = function(){
		for(var i=0;workers[i];i++){
			if(workers[i].activeTasks==0){
				return workers[i];
			}
		}
	}
	thiz.execute=function(name, params,callback){
		//Generate a random identifier
		var rand = Math.floor(Math.random()*100000000000);
		
		//Define the "task" object
		var task={
			name:name,
			params:params,
			callbackHash:rand,
			timestamp:new Date(),
			callback:callback,
		};
		
		//Assign new task to worker
		queuedTaks.push(task);
		unqueueTasks();
	}
	var unqueueTasks = function(){
		while(queuedTaks[0]){
			var freeWorker=getFreeWorker();
			if(freeWorker){
				freeWorker.executeTask(queuedTaks.pop());
			}else{
				break;
			}
		}
	}
	var init = function(){
		for(var i=0;i<numWorkers;i++){
			addWorker();
		}
		if(!workers[0]){
			addWorker(true);
		}
	};
	thiz.printStatistics = function(){
		for(var i=0;workers[i];i++){
			console.log(workers[i].getStatistics());
		}
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
		FIX Blob error
		Add requireJS support for workers
		
	***/
};

var coroWorker = function(settings){
	//Store the reference to itself to a "safe" variable to avoid breaking the scope.
	var thiz=this;
	var simulateWorker = settings.simulateWorker;
	var webWorker;
	//Functions is an array of functions {name,code} which is going to send to the worker to be executed lately
	var functions = settings.functions;
	//List of current tasks
	var tasks=[];
	//Total number active tasks
	thiz.activeTasks=0;
	//Time in milliseconds spend on all the tasks assigned to this worker
	thiz.timeSpend=0;
	//Total number of tasks initiated
	thiz.totalTasks=0;
	
	//Returns a string with the statistics of this worker
	thiz.getStatistics = function(){
		return "Worker "+thiz.id+" has processed "+thiz.totalTasks+" tasks in "+thiz.timeSpend+" milliseconds";
	}
	
	//Executes the tasks in this worker
	this.executeTask = function(task){		
		//Update the statistics of worker
		updateStatisticsPreTask(task);
		//Start task
		startTask(task);
	}
	
	//This functions is going to overide in case of a simulation
	var startTask = function(task){
		//Send task to worker
		webWorker.postMessage(JSON.stringify(task));
	}
	
	//Contatenate the functions into a switch statement
	var concatenateCodeIntoSwitchCases = function(functions){
		var num=functions.length;
		var code="";
		for(var i=0;i<num;i++){
			var f =functions[i];
			//Concatenate all the functions and codes in a switch/case structure
			code+='case "'+f.name+'":'+f.code+';break;'
		}
		code+="default:result={success:false,message:'Not implemented'};break;";
		code = "var params = o.params; var result={success:true}; switch(o.name){"+code+"}; result.callbackHash=o.callbackHash; ";
		return code;
	}
	
	//Converts the functions list to a Blob ready to be sent to the worker
	var generateBlob = function(functions){
		var code = concatenateCodeIntoSwitchCases(functions);
		var callback = "self.postMessage(JSON.stringify(result));";
		//Wrap the functions within a pre parse of the input and post parse of the result
		var finalCode = "self.addEventListener('message',function(e){var o=JSON.parse(e.data);"+code+callback+"},false);";
		//Generate the Blob as a Javascript file-like object
		return URL.createObjectURL(new window.Blob([finalCode],{type:"text/javascript"}));
	}
	
	//Converts the functions an evaluable string
	var generateEvaluableString = function(functions){
		var code = concatenateCodeIntoSwitchCases(functions);
		var callback = "callbackWorker(result);";
		//Wrap the functions within a pre parse of the input and post parse of the result
		var finalCode = "startTask=function(o){"+code+callback+"}";
		//Generate the Blob as a Javascript file-like object
		return finalCode;
	}
	
	//Properties to be updated when the tasks finishes
	var updateStatisticsPostTask = function(task,result){
		//Calculate the milliseconds spent on the task
		var timeSpend = result.timestamp.getTime()-task.timestamp.getTime();
		//Add the time spent on the tasks to the total
		thiz.timeSpend +=timeSpend;
		//Reflect that the tasks has finished on the total number of active tasks
		thiz.activeTasks--;
		
		//Output some text to have a visible confirmation
		console.log("Return task "+task.callbackHash+" to function "+task.name+" from worker num "+thiz.id);
	}
	
	//Properties to be updated when a tasks is to be initiated
	var updateStatisticsPreTask = function(task){
		//Save the task with the random identifier
		tasks[task.callbackHash] = task;
		//Reflect that the action is active
		thiz.activeTasks++;
		//Reflect that we started another task in the worker
		thiz.totalTasks++;
		
		//Output some text to have a visible confirmation
		console.log("Init task "+task.callbackHash+" to function "+task.name+" from worker num "+thiz.id);
	}
	
	//Callback when the worker finishes a task
	var callbackWorker = function(result){
		//We calculate the timestamp where the worker has finished
		result.timestamp = new Date();
		//Retrieve the task using the callbackHash
		var task = tasks[result.callbackHash];
		//Update the statistics of the worker once the tasks has finished
		updateStatisticsPostTask(task,result);
		//Execute the global callback to notify the worker manager that a task has finished
		setTimeout(settings.callback,0);
		
		//Execute the callback of the task to notify the initiator of the task that it has finished
		/*setTimeout(function(){*/task.callback({result:result,task:task});/*},0);*/
	}
	//Initialize the coroWorker
	var init = function(){
		if(simulateWorker){
			eval(generateEvaluableString(functions));
		}else{
			//Initialize the worker with all the specified functions
			webWorker = new Worker(generateBlob(functions));
			//Specify the callback when the worker finishes
			webWorker.addEventListener('message', function(e) { callbackWorker(JSON.parse(e.data)); }, false);
		}
	}
	
	//Initialize the coroWorker
	init();
}