/* Copyright (C) Relevance Lab Private Limited- All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Relevance UI Team,
 * Aug 2015
 */

(function() {
	"use strict";
	angular.module('workzone.orchestration')
		.controller('chefLogCtrl', ['$q', '$scope', 'workzoneServices', '$interval', 'orchestrationSetting', function($q, $scope, workzoneServices, $interval, orchestrationSetting) {
			/*This controller can be invoked from either of two flows - Chef Log History Item Logs OR Chef Task Execute
			items object will contain only taskId and historyId. */

			var items=$scope.parentItemDetail;
			$scope.isInstanceListLoading = true;
			$scope.selectedInstance; //scope to get the selected instance.
			angular.extend($scope, {
				logList: [],
				cancel: function() {
					helper.stopPolling();
				}
			});
			
			var chefLogData = {
				chefHistoryItem: {},
				nodeIdsWithActionLog: {},
				logData: []				
			};
			var timerObject, logList, isFullLogs = true;
			
			var helper = {
				lastTimeStamp: '',
				getlastTimeStamp: function(logObj) {
					if (logObj instanceof Array && logObj.length) {
						var lastTime = logObj[logObj.length - 1].timestamp;
						return lastTime;
					}
				},
				logsPolling: function() {
					timerObject = $interval(function() {
						workzoneServices.getChefJobLogs($scope.selectedInstance.nodeId, $scope.selectedInstance.actionLogId, helper.lastTimeStamp)
							.then(function(resp) {
								if (resp.data.length) {
									helper.lastTimeStamp = helper.getlastTimeStamp(resp.data);
									var logData = {
										logs: resp.data,
										fullLogs: false
									};
									chefLogData.logData.logs.push.apply(chefLogData.logData.logs, resp.data);
								}
							});

					}, orchestrationSetting.orchestrationLogsPollerInterval);
				},

				stopPolling: function() {
					$interval.cancel(timerObject);
				}
			};
			var selectFirstInstance = function(firstInstance){
				$scope.selectedInstance = firstInstance;
				chefLogData.instanceChange();
			};
			var init = function(firstInstance) {
				//get the details of one chef history entry
				workzoneServices.getTaskHistoryItem(items.taskId, items.historyId).then(function(response) {
					chefLogData.createInstanceList(response.data);
				});
			};

			//method to get the names of the nodes associated to the job and add it to the nodeIdsWithActionLog object.
			chefLogData.createInstanceList = function(historyItem) {
				workzoneServices.postRetrieveDetailsForInstanceNames(historyItem.nodeIds).then(function(response) {
					var _jobInstances = response.data;
					for (var i = 0; i < historyItem.nodeIdsWithActionLog.length; i++) {
						for (var j = 0; j < _jobInstances.length; j++) {
							if (historyItem.nodeIdsWithActionLog[i].nodeId === _jobInstances[j]._id){
								historyItem.nodeIdsWithActionLog[i].uiNodeName = _jobInstances[j].name;
							}
						}
					}
					
					chefLogData.chefHistoryItem = historyItem; //saved as we need timestamps from the historyItem
					chefLogData.nodeIdsWithActionLog = historyItem.nodeIdsWithActionLog; //this can now be used to show instance dropdown
					if (chefLogData.nodeIdsWithActionLog[0]) {
						$scope.isInstanceListLoading = false;
						selectFirstInstance(chefLogData.nodeIdsWithActionLog[0]);
					}					
				}, function(error) {
					$scope.isInstanceListLoading = false;
					$scope.errorMessage = "";
				});
			};
			//method called when user changes the instance name from the dropdown.
			chefLogData.instanceChange = function(instance) {
				$scope.isLogsLoading = true;
				helper.stopPolling(); //Ensuring polling is stopped, eventhough the scope values for instance id and actionlog id are updated on change
				helper.lastTimeStamp = '';
				/* when task is completed, with success or failed:
				 	- both timestampStarted and timestampEnded will be present
					- we get full logs, no need to poll
				*/
				if(chefLogData.chefHistoryItem.timestampStarted && chefLogData.chefHistoryItem.timestampEnded){
					workzoneServices.getChefJobLogs($scope.selectedInstance.nodeId, $scope.selectedInstance.actionLogId, chefLogData.chefHistoryItem.timestampStarted, chefLogData.chefHistoryItem.timestampEnded).then(function(response){
						$scope.isLogsLoading = false;
						logList = response.data;
						var logData = {
							logs: logList,
							fullLogs: true
						};
						chefLogData.logData = logData;
					}, function(error){
						$scope.isLogsLoading = false;
						$scope.errorMessage = "Unable to fetch logs for this instance";
					});
				}
				
				/* when task is pending or running: ie. during Execute flow or if history is viewed immediately after Execute
					- only timestampStarted will be present. timestampEnded will be absent
					- we need to poll for further logs
				*/
				else if(chefLogData.chefHistoryItem.timestampStarted && !chefLogData.chefHistoryItem.timestampEnded){
					workzoneServices.getChefJobLogs($scope.selectedInstance.nodeId, $scope.selectedInstance.actionLogId, chefLogData.chefHistoryItem.timestampStarted).then(function(response){
						$scope.isLogsLoading = false;
						helper.lastTimeStamp = helper.getlastTimeStamp(response.data) || chefLogData.chefHistoryItem.timestampStarted;
						logList = response.data;
						helper.logsPolling();
						var logData = {
							logs: logList,
							fullLogs: false
						};
						chefLogData.logData = logData;
					}, function(error){
						$scope.isLogsLoading = false;
						$scope.errorMessage = "Unable to fetch logs for this instance";
					});
				}
			};

			init();
			
			return chefLogData;
		}]);
})();