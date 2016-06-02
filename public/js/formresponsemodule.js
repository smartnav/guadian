angular
.module('response',['ngTable','ngAlertify','ngAnimate','toaster'])
.controller('FormResponse',function($scope,$http,NgTableParams,$timeout,$compile,alertify){
	$scope.argu = {};
	$scope.responses = {};
	$scope.total = 0;
        
    $scope.formstatus = 'published';
    $emailSelectedResponseID = 0;
    $emailSelectedFormID = 0;
    $scope.textareaText = "";

    $scope.changeFormStatus = function(status){

        $scope.getFormResponses.page(1);
        $scope.formstatus = status;
        $scope.formResponsesCount();
        $scope.getFormResponses.reload();

    }

    $scope.formResponsesCount = function() {

            $http.post('/getFormResponsesCount',{formid:$scope.formid,status:$scope.formstatus}).then(function(response){

            $scope.total = response.data.total
            })
        
    }

    $scope.getFormResponses  =  new NgTableParams({
                count:5
            }, {
              
              counts:[],
              paginationMaxBlocks: 10,  
              getData: function(params) {
               
                    
                return $http.post('/getFormResponses',{formid:$scope.formid,status:$scope.formstatus,offset:params.page(),limit:5}).then(function(response){

                    $scope.responses = response.data;
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
                obj.contacted_status = data[i].contacted_status;
                obj.date = data[i].created;
                newlyFormatedResponses[data[i].responderid] = obj; //create a new object there
            }

            var obj = newlyFormatedResponses[data[i].responderid];
            
            obj.questions.push({"id":data[i].questionid, "type":data[i].type, "text":data[i].question, "response_text":data[i].textval, "response_rating":data[i].rateval,"owner_id":data[i].owner_id, "is_hide":data[i].is_hide});

        }
        console.log("newly",newlyFormatedResponses);
        return newlyFormatedResponses;
    }
    $scope.formResponseToggleStatus = function(model,id,status) {


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
                    $scope.formResponsesCount();
                    $scope.getFormResponses.reload();
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
    $scope.generateEmailToResponder = function(model,id, responseid, status) {
        $scope.argu.model = model;
        $scope.argu.id = id;
        $scope.argu.responseid = responseid;
        $scope.argu.status = status;
        console.log("We clicked email");
        console.log(model, id, responseid, status);

        /* Early Exit for unapproved responses */
        if(status != "approved") {
            alertify.delay(2000).error('You cannot send an email to an unapproved response.');
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
                    if(response.data.data.yelp=="" || response.data.data.google_plus=="")
                    {
                        $('#YelpGoogle').show();
                    }
                    else
                        $('#YelpGoogle').hide();
                    $('textarea#rescomments').val(response.data.email);
                    $('#emailModal').modal() ///  
                }
            
            },function(err){

                if(err) {
                    alertify.delay(2000).error('There was an error preparing the email.');
                }
            })
        //$('#rescomments').val(comments);
        //$('#rescomments').attr('class',id);
        

    }

$scope.SaveYG = function(data) {
        $http.post('/form/'+data.id+'/facility/', {data:data}).then(function(response){
            if(response)
            {
                alertify.delay(2000).success('Success!');
                $scope.generateEmailToResponder($scope.argu.model,$scope.argu.id,$scope.argu.responseid,$scope.argu.status);
            }
        
        },function(err){

            if(err) {
                alertify.delay(2000).error('There was an error updating Facility.');
            }
        });
    }

    $scope.sendEmailToResponder = function() {
        console.log("We are going to send an email");
        var contents = $('textarea#rescomments').val();
        //sanitify check
        if(contents.length < 50) {
            alertify.delay(2000).error('The message was malformed. Did you send everything that you wanted to?');
            return;
        }
        if(contents.length > 5000) {
            alertify.delay(2000).error('The message was malformed. Try shortening your message.');
            return;
        }

        $http.post('/form/' + $emailSelectedFormID + '/email/' + $emailSelectedResponseID, {email:contents}).then(function(response){
            if(response.data)
            {
                alertify.delay(2000).success('Message sent!');

            }
        
        },function(err){

            if(err) {
                alertify.delay(2000).error('There was an error sending the email.');
            }
        });
        
    }

    $scope.editFormResponse = function(id,comments,data) {
        $scope.textQuestions = [];
        $('#rescomments').val(comments);
        $('#rescomments').attr('class',id);
        $('#erModal').modal()
        console.log(id,comments)
        for(var i in data)      
                        {       
                            if(data[i].type=="text")        
                            {       
                             $scope.textQuestions.push({"id":data[i].id, "type":data[i].type, "text":data[i].text, "response_text":data[i].response_text, "response_rating":data[i].response_rating, "owner_id":data[i].owner_id});     
                            }       
                        }
    }

    $scope.updateFormResponse = function(data) {
        var comments = $('#rescomments').val();
        var id = $('#rescomments').attr('class');
        $http.post('/review/updateResponse',{id: id,comments:comments,data:data}).then(function(response){

                if(response.data.updated)
                {
                    alertify.delay(2000).success('Response Updated Successfully');
                    $('#erModal').modal('toggle');
                    $scope.formResponsesCount();
                    $scope.getFormResponses.reload();
                    $timeout(function(){
                        $scope.$apply();
                    },500)
                }
            
            },function(err){

                if(err) {
                    alertify.delay(2000).error('Oops! There was an error updating the response.');
                }
            })
    }
   
    
}).directive('myMaxlength', ['$compile', '$log', function($compile, $log) {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function (scope, elem, attrs, ctrl) {
                attrs.$set("ngTrim", "false");
                var maxlength = parseInt(attrs.myMaxlength, 10);
                ctrl.$parsers.push(function (value) {
                    $log.info("In parser function value = [" + value + "].");
                    if (value.length > maxlength)
                    {
                        $log.info("The value [" + value + "] is too long!");
                        value = value.substr(0, maxlength);
                        ctrl.$setViewValue(value);
                        ctrl.$render();
                        $log.info("The value is now truncated as [" + value + "].");
                    }
                    return value;
                });
            }
        };
    }]);

