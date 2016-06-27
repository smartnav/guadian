angular
.module('share',['toaster', 'ngAnimate','ngclipboard'])
.controller('ShareLink',function($scope,$http,toaster){
	$scope.onSuccess = function(e) {
    toaster.pop('success', "Success", 'Copied Successfully');
    console.info('Action:', e.action);
    console.info('Text:', e.text);
    console.info('Trigger:', e.trigger);

    e.clearSelection();
};

$scope.onError = function(e) {
    toaster.pop('error', "Error", 'Error copying text.');
    console.error('Action:', e.action);
    console.error('Trigger:', e.trigger);
}
	$scope.forms = {};
	$scope.formid=0;
    $scope.linkurl = window.location.href.replace('share','');
	$scope.jsurl = window.location.href.replace(/(form|responses)/,'js/$1').replace('/share','.js');
	$scope.getForms = function() {

    		$http.post('/usergroup/getgroups',{offset:1,limit:10000}).then(function(response){
            if(response.data.result.length>0) { 
                $scope.forms = response.data.result;
                $scope.formid = $scope.forms[0].id;
                $scope.makeLink();
            }
    		
            else
           {
            $scope.forms.push({facility:"Select Form",id:0});
           }
           })

    }

    $scope.getForms();

    $scope.makeLink = function(){

    	$scope.link = $scope.linkurl+''+$scope.formid;
    }


})

