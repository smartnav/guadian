angular
.module('dashboard',['ngTable','ngAlertify','toaster', 'ngAnimate'])
// .controller('Response',function($scope,$http,NgTableParams,$timeout,$compile,alertify,toaster){
	
// 	$scope.responses = {};
// 	$scope.total = 0;
    



// 	$scope.getResponses =  new NgTableParams({
//         count:5
// 	}, {
	  
//       counts:[],
//       paginationMaxBlocks: 10,	
//       getData: function(params) {
       
        	
// 		return $http.post('/getResponses',{offset:params.page(),limit:5}).then(function(response){

// 			$scope.responses = response.data;
// 			params.total($scope.total);
			
// 			return response.data;
// 		})
		
//       }
//     });

	

//     $scope.responsesCount = function() {

//     		$http.get('/getResponsesCount').then(function(response){
//                 $scope.getGroupData();
//     		$scope.total = response.data.total
//     		})
    	
//     }

//     $scope.responsesCount();


//     $scope.toggleStatus = function(model,id,status) {


//         if(status=='trashed')
//         {
//             var conf = confirm('Are You Sure Want to Delete This?');
//             if(conf===false)
//                 return;
//         }


//     	$http.post('/review/togglestatus',{model:model,id: id,status:status}).then(function(response){

//     			if(response.data.changed)
//     			{
//                     toaster.pop('success', "Success", status+' Successfully');
//                     if(status=='unapproved')
//                     {
//                         var chstatus = "'approved'" 
//                         var chstatustxt = 'Approve'
//                         var cssclass = 'btn btn-primary'
//                     }
//                     if(status=='approved'){
//                             var chstatus = "'unapproved'" 
//                             var chstatustxt = 'Unapprove'
//                             var cssclass = 'btn btn-danger'
//                     }
                     
//                    if(status!='trashed') {
//                     var dbid = "'"+id+"'"
//                         $("#responses #"+id).html(
//                           $compile(
//                             '<button class="'+cssclass+'" ng-click="toggleStatus(\'responders\','+dbid+','+chstatus+')">'+chstatustxt+'</button>'
//                           )($scope)
//                         );
//                    }
//                    if(status=='trashed') {
//                     $('#responses-'+id).remove();
//                    }
                    
//                 }	
    		
//     		},function(err){

//     			if(err) {
//     				toaster.pop('error', "Error", 'Woops! There was an error updating the response.');
//     			}
//     		})
//     }

//     $scope.editResponse = function(id,comments) {

//         $('#rescomments').val(comments);
//         $('#rescomments').attr('class',id);
//         $('#erModal').modal()
//         console.log(id,comments)

//     } 

//     $scope.updateResponse = function() {
//         var comments = $('#rescomments').val();
//         var id = $('#rescomments').attr('class');
//         $http.post('/review/updateResponse',{id: id,comments:comments}).then(function(response){

//                 if(response.data.updated)
//                 {
//                     //alertify.delay(2000).success('Response Updated Successfully');
// 		    toaster.pop('success', "Success", 'Response Updated Successfully');
//                     $('#erModal').modal('toggle');
//                     $scope.responsesCount();
//                     $scope.getResponses.reload();
//                     $timeout(function(){
//                         $scope.$apply();
//                     },500)
//                 }
            
//             },function(err){

//                 if(err) {
//                     toaster.pop('error', "Error", 'Woops! There was an error updating the response.');
//                 }
//             })
//     }


// })

.controller('ActiveForms',function($scope,$http,NgTableParams,$timeout,$compile,alertify,toaster){
    $scope.activeforms = {};
    $scope.total = 0;
    $scope.gradios = {};

$scope.hover = function(data) {
        // Shows/hides the delete button on hover
      return data.showDelete = ! data.showDelete;
    };
    $scope.getActiveForms =  new NgTableParams({
        count:15
    }, {
      
      counts:[],
      paginationMaxBlocks: 10,   
      getData: function(params) {
       
            
        return $http.post('/getActiveForms',{offset:params.page(),limit:15}).then(function(response){

            $scope.activeforms = response.data;
            params.total($scope.total);
            for(var i in response.data)
            {
            response.data[i].showDelete=false;
            response.data[i].show= true;
            }
            return response.data;
        })
        
      }
    });

    $scope.getGroupForms =  new NgTableParams({
        count:15
    }, {
      
      counts:[],
      paginationMaxBlocks: 10,   
      getData: function(params) {
       
            
        return $http.post('/usergroup/form',{offset:params.page(),limit:15}).then(function(response){
            params.total($scope.total1);
            return response.data.result;
        })
        
      }
    });

    $scope.getGroupData = function(){
         $http.get("/usergroup/show").then(function(response){
         $scope.groups = response.data.result;
         
           })
     }

     $scope.getGroupData();
    $scope.SelectGroup = function(data) {
        $scope.showDiv=false;
        $scope.gname="";
        $('#erModal').modal();
        $('#formid').val(data.id);
        }

    $scope.AddToGroup = function(data) {
        data.id = $('#formid').val();
        $http.post("/usergroup/update",data).then(function(response){
            $scope.activeformsCount();
            $scope.groupformsCount();
            $scope.getActiveForms.reload();
            $scope.getGroupForms.reload();
           toaster.pop('success', "Success", 'Form Update Successfully.');
           $("#erModal").modal('hide');

        },function(err){

                if(err) {
                    toaster.pop('error', "Error", 'Woops! There was an error updating the form.');
                }
            })
    }
    

    $scope.activeformsCount = function() {

            $http.get('/getActiveFormsCount').then(function(response){

            $scope.total = response.data.total;
            })
        
    }

    $scope.activeformsCount();

    $scope.groupformsCount = function() {

            $http.get('/getGroupFormsCount').then(function(response){

            $scope.total1 = response.data.total;
            })
        
    }

    $scope.groupformsCount();
    
     $scope.toggleStatus = function(model,id,status,AppRes,UnAppRes,formOwnerId) {
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
    

        $http.post('/review/togglestatus',{model:model,id: id,status:status,coutRes:coutRes,owner_id:formOwnerId}).then(function(response){

                if(response.data.changed)
                {
                    //alertify.delay(2000).success(status+' Successfully');
		    toaster.pop('success', "Success", status+' Successfully');
                    if(status=='unpublished')
                    {
                        var chstatus = "'published'" 
                        var chstatustxt = 'Publish'
                        var cssclass = 'btn btn-primary'
                    }
                    if(status=='published'){
                            var chstatus = "'unpublished'" 
                            var chstatustxt = 'Unpublish'
                            var cssclass = 'btn btn-cancel'
                    }
                     
                   if(status!='trashed') {

                        var dbid = "'"+id+"'"
                        $("#activeForms #"+id).html(
                          $compile(
                            '<button class="'+cssclass+'" ng-click="toggleStatus(\'forms\','+dbid+','+chstatus+','+AppRes+','+UnAppRes+','+formOwnerId+')">'+chstatustxt+'</button>'
                          )($scope)
                        );
                         $("#groupForms #"+id).html(
                          $compile(
                            '<button class="'+cssclass+'" ng-click="toggleStatus(\'forms\','+dbid+','+chstatus+','+AppRes+','+UnAppRes+','+formOwnerId+')">'+chstatustxt+'</button>'
                          )($scope)
                        );


                   }
                   if(status=='trashed') {
                    $('#forms-'+id).remove();
                   }
                    
                }   
            
            },function(err){

                if(err) {
		    toaster.pop('error', "Error", 'Woops! There was an error updating the response.');
                    //alertify.delay(2000).error('Woops! There was an error updating the response.');
                }
            })
    }
    $scope.createGroup = function(data) {
       $http.post("/usergroup/add",{name:data}).then(function(resp){
        toaster.pop('success', "Success", 'Group Created Successfully.');
      $scope.getGroupData();
       },function(err){

                if(err) {
                    toaster.pop('error', "Error", 'Woops! There was an error creating the group.');
                }
            })
    }
 })