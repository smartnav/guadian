angular
.module('groups',['toaster', 'ngAnimate', "ui.bootstrap" , "angular-confirm"])

.controller('groupManage',function($scope, $uibModal, $confirm,$http,$timeout,$compile,toaster){
    
    $scope.groupData = {};
    $scope.get_group = function()
    {
    	$('#loadingdiv').addClass('loading')
	$http.post('/groups/get_group', {}).then(function(response){
	    //console.log(response);
	    var a = response.data.val;
	    var c={};
	    var existValue = 0;
	    for(var i in a)
	    {
	      if (a[i].group_name) {
		existValue = 1;
		c[a[i].id] = c[a[i].id] ? c[a[i].id] : {};
		c[a[i].id].group_name = a[i].group_name;
		c[a[i].id].creator_email = a[i].creator_email;
		c[a[i].id].users = c[a[i].id].users ? c[a[i].id].users  : [];
		var data = {'u_id' :a[i].u_id,'email' : a[i].email };
		c[a[i].id].users.push(data);
	      }
	      
	      
	    }
	    console.log(c);
	    $scope.existValue = existValue;
	    $scope.groupData = c;
	    $('#loadingdiv').removeClass('loading')
	},function(err){
		    if(err) {
			    toaster.pop('error', "Error", 'Woops! There was an error getting the response.');
			    $('#loadingdiv').removeClass('loading')
		    }
    		});
    }
    
    $scope.get_group();
    
    $scope.addGroup = function()
    {
    	$('#myModalNorm').modal('hide');
    	$('#loadingdiv').addClass('loading')
	//toaster.pop('error', "Error", $scope.group_name);
	var group_name = $scope.group_name;
	$http.post('/usergroup/add',{name:group_name}).then(function(response){
	    //console.log(response);
	    toaster.pop('success', "Success", 'Group successfully created.');
	    $scope.get_group();
	    $('#loadingdiv').removeClass('loading')
	},function(err){
		    if(err) {
			    toaster.pop('error', "Error", 'Woops! There was an error adding group.');
			    $('#myModalNorm').modal();
			    $('#loadingdiv').removeClass('loading')
		    }
    		})
    }
    
    $scope.user_email = {};
    $scope.addUser = function(index, groupID)
    {
    	$('#loadingdiv').addClass('loading')
	var userEmail = $scope.user_email[index];
	$http.post('/groups/addUser', {userEmail:userEmail, groupID:groupID}).then(function(response){
		if(response.data.value==0)
		{
			toaster.pop('error',"Error", 'No User with the specified Email Id Found.');
			$('#loadingdiv').removeClass('loading')
		}
		else if(response.data.value==1)
	    {
	    		$scope.get_group();
	    	    $scope.user_email[index] = "";
	    	    toaster.pop('success', "Success", 'User add successfully created.');
	    	    $('#loadingdiv').removeClass('loading')
	    }
	    else if(response.data.value==2)
	    {
	    	toaster.pop('error',"Error", 'User already exists.');
	    	$('#loadingdiv').removeClass('loading')
	    }
	},function(err){
		    if(err) {
			    toaster.pop('error', "Error", 'Woops! There was an error adding the user.');
			    $('#loadingdiv').removeClass('loading');
		    }
    		})
    }

    $scope.delUser = function (userID, groupID)
    {
    $confirm({text: 'Are you sure you want to delete?'})
        .then(function() {
        	$('#loadingdiv').addClass('loading')
              $http.post('/groups/delUser',{userID:userID, groupID:groupID}).then(function(response){
		toaster.pop('success', "Success", 'User Deleted successfully.');
		    $scope.get_group();
		    $('#loadingdiv').removeClass('loading')
		},function(err){
				if(err) {
					$('#loadingdiv').removeClass('loading')
					toaster.pop('error', "Error", 'Woops! There was an error deleting the user.');
				}
			    })
        });
    }

    $scope.delGroup = function (groupID)
    {
    $confirm({text: 'Are you sure you want to delete?'})
        .then(function() {
        	$('#loadingdiv').addClass('loading')
	    $http.post('/groups/delGroup',{groupID:groupID}).then(function(response){
		toaster.pop('success', "Success", 'Successfully Deleted.');
		$scope.get_group();
		$('#loadingdiv').removeClass('loading')
	    },function(err){
			    if(err) {
				    toaster.pop('error', "Error", 'Woops! There was an error deleting the group.');
				    $('#loadingdiv').removeClass('loading')
			    }
			})
	    });
    }
 })