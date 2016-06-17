angular
.module('share',[])
.controller('ShareLink',function($scope,$http){
	
	$scope.forms = {};
	$scope.formid=0;
    $scope.linkurl = window.location.href.replace('share','');
	$scope.jsurl = window.location.href.replace(/(form|responses)/,'js/$1').replace('/share','.js');
	$scope.getForms = function() {

    		$http.post('/usergroup/getgroups',{offset:1,limit:10000}).then(function(response){

    		$scope.forms = response.data.result
    		})
    	
    }

    $scope.getForms();

    $scope.makeLink = function(){

    	$scope.link = $scope.linkurl+''+$scope.formid;
    }


})

