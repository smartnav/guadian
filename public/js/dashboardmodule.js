angular
.module('dashboard',['ngTable','ngAlertify'])
.controller('Response',function($scope,$http,NgTableParams,$timeout,$compile,alertify){
	
	$scope.responses = {};
	$scope.total = 0;




	$scope.getResponses =  new NgTableParams({
        count:5
	}, {
	  
      counts:[],
      paginationMaxBlocks: 10,	
      getData: function(params) {
       
        	
		return $http.post('/getResponses',{offset:params.page(),limit:5}).then(function(response){

			$scope.responses = response.data;
			params.total($scope.total);
			
			return response.data;
		})
		
      }
    });

	

    $scope.responsesCount = function() {

    		$http.get('/getResponsesCount').then(function(response){

    		$scope.total = response.data.total
    		})
    	
    }

    $scope.responsesCount();


    $scope.toggleStatus = function(model,id,status) {


        if(status=='trashed')
        {
            var conf = confirm('Are You Sure Want to Delete This?');
            if(conf===false)
                return;
        }


    	$http.post('/review/togglestatus',{model:model,id: id,status:status}).then(function(response){

    			if(response.data.changed)
    			{
                    alertify.delay(2000).success(status+' Successfully');
                    if(status=='unapproved')
                    {
                        var chstatus = "'approved'" 
                        var chstatustxt = 'Approve'
                        var cssclass = 'btn btn-primary'
                    }
                    if(status=='approved'){
                            var chstatus = "'unapproved'" 
                            var chstatustxt = 'Unapprove'
                            var cssclass = 'btn btn-danger'
                    }
                     
                   if(status!='trashed') {
                    var dbid = "'"+id+"'"
                        $("#responses #"+id).html(
                          $compile(
                            '<button class="'+cssclass+'" ng-click="toggleStatus(\'responders\','+dbid+','+chstatus+')">'+chstatustxt+'</button>'
                          )($scope)
                        );
                   }
                   if(status=='trashed') {
                    $('#responses-'+id).remove();
                   }
                    
                }	
    		
    		},function(err){

    			if(err) {
    				alertify.delay(2000).error('Woops! There was an error updating the response.');
    			}
    		})
    }

    $scope.editResponse = function(id,comments) {

        $('#rescomments').val(comments);
        $('#rescomments').attr('class',id);
        $('#erModal').modal()
        console.log(id,comments)

    } 

    $scope.updateResponse = function() {
        var comments = $('#rescomments').val();
        var id = $('#rescomments').attr('class');
        $http.post('/review/updateResponse',{id: id,comments:comments}).then(function(response){

                if(response.data.updated)
                {
                    alertify.delay(2000).success('Response Updated Successfully');
                    $('#erModal').modal('toggle');
                    $scope.responsesCount();
                    $scope.getResponses.reload();
                    $timeout(function(){
                        $scope.$apply();
                    },500)
                }
            
            },function(err){

                if(err) {
                    alertify.delay(2000).error('Woops! There was an error updating the response.');
                }
            })
    }




})

.controller('ActiveForms',function($scope,$http,NgTableParams,$timeout,$compile,alertify){

    $scope.activeforms = {};
    $scope.total = 0;

    $scope.getActiveForms =  new NgTableParams({
        count:15
    }, {
      
      counts:[],
      paginationMaxBlocks: 10,   
      getData: function(params) {
       
            
        return $http.post('/getActiveForms',{offset:params.page(),limit:15}).then(function(response){

            $scope.activeforms = response.data;
            params.total($scope.total);
            
            return response.data;
        })
        
      }
    });

    

    $scope.activeformsCount = function() {

            $http.get('/getActiveFormsCount').then(function(response){

            $scope.total = response.data.total
            })
        
    }

    $scope.activeformsCount();

    
     $scope.toggleStatus = function(model,id,status,AppRes,UnAppRes) {

        var coutRes = 0;
    if (UnAppRes > 0 || AppRes > 0) {
        coutRes = 1;
        
    }
        if(status=='trashed')
        {
            var conf = confirm('Are You Sure Want to Delete This?');
            if(conf===false)
                return;
        }
    

        $http.post('/review/togglestatus',{model:model,id: id,status:status,coutRes:coutRes}).then(function(response){

                if(response.data.changed)
                {
                    alertify.delay(2000).success(status+' Successfully');
                    if(status=='unpublished')
                    {
                        var chstatus = "'published'" 
                        var chstatustxt = 'Publish'
                        var cssclass = 'btn btn-primary'
                    }
                    if(status=='published'){
                            var chstatus = "'unpublished'" 
                            var chstatustxt = 'Unpublish'
                            var cssclass = 'btn btn-danger'
                    }
                     
                   if(status!='trashed') {

                        var dbid = "'"+id+"'"
                        $("#activeForms #"+id).html(
                          $compile(
                            '<button class="'+cssclass+'" ng-click="toggleStatus(\'forms\','+dbid+','+chstatus+')">'+chstatustxt+'</button>'
                          )($scope)
                        );

                   }
                   if(status=='trashed') {
                    $('#forms-'+id).remove();
                   }
                    
                }   
            
            },function(err){

                if(err) {
                    alertify.delay(2000).error('Woops! There was an error updating the response.');
                }
            })
    }
 })