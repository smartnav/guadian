angular
.module('responsedashboard',['ngTable','ngAlertify','toaster','ngAnimate'])
.controller('ActiveForms',function($scope,$http,NgTableParams,$timeout,$compile,alertify,toaster){
    $scope.argu = {};
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

    $scope.generateEmailToResponder = function(model,id, responseid, status) {
        $scope.argu.model = model;
        $scope.argu.id = id;
        $scope.argu.responseid = responseid;
        $scope.argu.status = status;
        console.log("We clicked email");
        console.log(model, id, responseid, status);

        /* Early Exit for unapproved responses */
        if(status != "approved") {
            //alertify.delay(2000).error('You cannot send an email to an unapproved response.');
            toaster.pop('error', "Error", 'You need to approve the response before you can send an email.');
            return;
        }
        $emailSelectedResponseID = responseid;
        $emailSelectedFormID = id;

        /* Get the email information */
        $http.get('/form/' + id + '/email/' + responseid).then(function(response){
                console.log("We got a response:", response);
                if(response.data)
                {
                    $scope.Yelp_Google = response.data.data;
                    if(response.data.data.yelp=="" || response.data.data.google_plus==""){
                        $('#YelpGoogle').show();
                }
                    else
                        $('#YelpGoogle').hide();
                    $('textarea#rescomments').val(response.data.email);
                    $('#emailModal').modal() ///           /review/:id/email/:responseid

                }
            
            },function(err){

                if(err) {
                    //alertify.delay(2000).error('There was an error preparing the email.');
                    toaster.pop('error', "Error", 'There was an error preparing the email.');
                }
            })
    };

    $scope.SaveYG = function(data) {
        $http.post('/form/'+data.id+'/facility/', data).then(function(response){
            if(response)
            {
                //alertify.delay(2000).success('Success!');
                toaster.pop('success', "Success", 'Success!');
                $scope.generateEmailToResponder($scope.argu.model,$scope.argu.id,$scope.argu.responseid,$scope.argu.status);
            }
        
        },function(err){

            if(err) {
                //alertify.delay(2000).error('There was an error updating Facility.');
                toaster.pop('error', "Error", 'There was an error updating Facility.');
            }
        });
    }

    $scope.sendEmailToResponder = function() {
        console.log("We are going to send an email");
        var contents = $('textarea#rescomments').val();
        //sanitify check
        if(contents.length < 50) {
            //alertify.delay(2000).error('The message was malformed. Did you send everything that you wanted to?');
            toaster.pop('error', "The message was malformed. Did you send everything that you wanted to?");
            return;
        }
        if(contents.length > 5000) {
            //alertify.delay(2000).error('The message was malformed. Try shortening your message.');
            toaster.pop('error', "The message was malformed. Try shortening your message.");
            return;
        }

        $http.post('/form/' + $emailSelectedFormID + '/email/' + $emailSelectedResponseID, {email:contents}).then(function(response){
            if(response.data)
                        {
                //alertify.delay(2000).success('Message sent!');
                toaster.pop('success', "Success", 'Message sent!');

            }
        
        },function(err){

            if(err) {
               // alertify.delay(2000).error('There was an error sending the email.');
               toaster.pop('error', "There was an error sending the email.");
            }
        });
        
    };


    $scope.getApprovedResponses  =  new NgTableParams({
                count:5
            }, {
              
              counts:[],
              paginationMaxBlocks: 10,  
              getData: function(params) {
               
                    
                return $http.post('/getApprovedResponses',{offset:params.page(),limit:5}).then(function(response){
                    $scope.responses = response.data;
                    console.log($scope.responses);
                    params.total($scope.total);
                    $scope.facility = response.data[0].facility
                    window.d = response.data;
                    var r = $scope.separateResponses(response.data);
                    window.r = r;
                    return r;
                })
                
              }
            }); 


    $scope.separateResponses = function(data) {
        console.log(data);
        var newlyFormatedResponses = {};
        for(var i = 0; i < data.length;i++) {
            if(!newlyFormatedResponses.hasOwnProperty(data[i].responderid)) {
                var obj = {};
                obj.questions = [];
                obj.facility = data[i].facility;
                obj.formid = data[i].formid;
                obj.responderid = data[i].responderid;
                obj.responder_name = data[i].name;
                obj.status = data[i].responder_status;
                obj.date = data[i].created;
                newlyFormatedResponses[data[i].responderid] = obj; //create a new object there
            }

            var obj = newlyFormatedResponses[data[i].responderid];
            
            obj.questions.push({"id":data[i].questionid, "type":data[i].type, "text":data[i].question, "response_text":data[i].textval, "response_rating":data[i].rateval});

        }
        return newlyFormatedResponses;
    }
    $scope.activeformsCount = function() {

            $http.get('/getActiveFormsCount').then(function(response){

            $scope.total = response.data.total
            })
        
    }

    $scope.activeformsCount();

    
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
                    //alertify.delay(2000).error('Woops! There was an error updating the response.');
                toaster.pop('error', "Woops! There was an error updating the response.");
                }
            })
    }
 })