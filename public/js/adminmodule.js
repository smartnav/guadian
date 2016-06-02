angular
.module('admin',['ngTable'])
.controller('Log',function($scope,$http,NgTableParams){
	
	$scope.logs = {};
	$scope.total = 0;

	$scope.getLogs =  new NgTableParams({
        count:15
	}, {
	  
      counts:[],
      paginationMaxBlocks: 25,	
      getData: function(params) {
       
        	
		return $http.post('/getLogs',{offset:params.page(),limit:15}).then(function(response){

			$scope.logs = response.data;
			params.total($scope.total);
			
			return response.data;
		})
		
      }
    });

	$scope.logsCount = function() {

    		$http.get('/getLogsCount').then(function(response){

    		$scope.total = response.data.total
    		})
    	
    }

    $scope.logsCount();


})

