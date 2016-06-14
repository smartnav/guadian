angular
.module('groups',['toaster', 'ngAnimate'])

.controller('groupManage',function($scope,$http,$timeout,$compile,toaster){
    
    
    $scope.get_group = function()
    {
	$http.post('/groups/get_group', {}).then(function(response){
	    //console.log(response);
	    var a = response.data.val;
	    var c={};
	    for(var i in a)
	    {
	      c[a[i].id] = c[a[i].id] ? c[a[i].id] : {};
	      c[a[i].id].group_name = a[i].group_name;
	      c[a[i].id].users = c[a[i].id].users ? c[a[i].id].users  : [];
	      var data = {'u_id' :a[i].u_id,'email' : a[i].email };
	      c[a[i].id].users.push(data);
	    }
	    console.log(c);
	    $scope.groupData = c;
	});
    }
    
    $scope.get_group();
    
    $scope.addGroup = function()
    {
	//toaster.pop('error', "Error", $scope.group_name);
	var group_name = $scope.group_name;
	$http.post('/groups/add_group',{group_name:group_name}).then(function(response){
	    //console.log(response);
	    toaster.pop('success', "Success", 'Group successfully created.');
	    $scope.get_group();
	    $('myModalNorm').modal('hide');
	},function(err){
		    if(err) {
			    toaster.pop('error', "Error", 'Woops! There was an error updating the response.');
		    }
    		})
    }
    
    $scope.user_email = {};
    $scope.addUser = function(index, groupID)
    {
	var userEmail = $scope.user_email[index];
	$http.post('/groups/addUser', {userEmail:userEmail, groupID:groupID}).then(function(response){
	    $scope.get_group();
	    $scope.user_email[index] = "";
	    toaster.pop('success', "Success", 'User add successfully created.');
	});
    }

    $scope.delUser = function (userID, groupID)
    {
    	console.log("index",userID);
    	console.log("groupid",groupID);
    $http.post('/groups/delUser',{userID:userID, groupID:groupID}).then(function(response){
    	$scope.get_group();
    	toaster.pop('success', "Success", 'User Deleted successfully.');
    })
    }
 })