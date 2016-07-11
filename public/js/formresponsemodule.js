angular
    .module('response', ['ngTable', 'ngAlertify', 'toaster', 'ngAnimate'])
    .controller('FormResponse', function($scope, $http, NgTableParams, $timeout, $compile, alertify, toaster) {
        $scope.argu = {};
        $scope.responses = {};
        $scope.total = 0;

        $scope.formstatus = 'published';
        $emailSelectedResponseID = 0;
        $emailSelectedFormID = 0;

        $scope.changeFormStatus = function(status) {

            $scope.getFormResponses.page(1);
            $scope.formstatus = status;
            $scope.formResponsesCount();
            $scope.getFormResponses.reload();

        }

        $scope.formResponsesCount = function() {

            $http.post('/getFormResponsesCount', { formid: $scope.formid, status: $scope.formstatus }).then(function(response) {

                $scope.total = response.data.total
            })

        }

        $scope.getFormResponses = new NgTableParams({
            count: 5
        }, {

            counts: [],
            paginationMaxBlocks: 10,
            getData: function(params) {
                
                return $http.post('/getFormResponses', { formid: $scope.formid, status: $scope.formstatus, offset: params.page(), limit: 5 }).then(function(response) {

                    if (response.data) {
                        $scope.responses = response.data;
                        params.total($scope.total);
                        $scope.facility = response.data[0].facility
                        window.d = response.data;
                        var r = $scope.separateResponses(response.data);
                        var arr = [];
                        for(var i in r)
                        {arr.push(r[i]);}
                        return arr;
                    }

                })

            }
        });

        $scope.separateResponses = function(data) {
            var newlyFormatedResponses = {};
            for (var i = 0; i < data.length; i++) {
                if (!newlyFormatedResponses.hasOwnProperty(data[i].responderid)) {
                    var obj = {};
                    obj.questions = [];
                    obj.facility = data[i].facility;
                    obj.formid = data[i].formid;
                    obj.responderid = data[i].responderid;
                    obj.responder_name = data[i].name;
                    obj.status = data[i].responder_status;
                    obj.contacted_status = data[i].contacted_status;
                    obj.date = data[i].created;
                    obj.owners_id = data[i].owner_id;
                    newlyFormatedResponses[data[i].responderid] = obj; //create a new object there
                }

                var obj = newlyFormatedResponses[data[i].responderid];

                obj.questions.push({ "id": data[i].questionid, "type": data[i].type, "text": data[i].question, "response_text": data[i].textval, "response_rating": data[i].rateval, "owner_id": data[i].owner_id, "is_hide": data[i].is_hide, "formid": data[i].formid,"orderid": data[i].orderid });

            }
            return newlyFormatedResponses;
        }
        $scope.formResponseToggleStatus = function(model, id, status, owner_id) {


            if (status == 'trashed') {
                var conf = confirm('Are You Sure Want to Delete This?');
                if (conf === false)
                    return;
            }

            $http.post('/review/togglestatus', { model: model, id: id, status: status, owner_id }).then(function(response) {

                if (response.data.changed) {
                    //alertify.delay(2000).success(status+' Successfully');
                    toaster.pop('success', "Success", status + ' Successfully');
                    $scope.formResponsesCount();
                    $scope.getFormResponses.reload();
                    $timeout(function() {
                        $scope.$apply();
                    }, 500)

                }

            }, function(err) {

                if (err) {
                    //alertify.delay(2000).error('Woops! There was an error updating the response.');
                    toaster.pop('error', "Error", 'Woops! There was an error updating the response.');
                }
            })
        }
        $scope.generateEmailToResponder = function(model, id, responseid, status) {
            $scope.argu.model = model;
            $scope.argu.id = id;
            $scope.argu.responseid = responseid;
            $scope.argu.status = status;
            console.log("We clicked email");
            console.log(model, id, responseid, status);

            /* Early Exit for unapproved responses */
            if (status != "approved") {
                //alertify.delay(2000).error('You cannot send an email to an unapproved response.');
                toaster.pop('error', "Error", 'You cannot send an email to an unapproved response.');

                return;
            }
            $emailSelectedResponseID = responseid;
            $emailSelectedFormID = id;

            /* Get the email information */
            $http.get('/form/' + id + '/email/' + responseid).then(function(response) {
                    console.log("We got a response:", response);
                    if (response.data) {
                        $scope.Yelp_Google = response.data.data;
                        if (response.data.data.yelp == "" || response.data.data.google_plus == "" || response.data.data.caring == "") {
                            $('#YelpGoogle').show();
                        } else
                            {$('#YelpGoogle').hide();}
                         //   var res = response.data.emailData.replace(/\n/g, ""); 
                            $('#mailTo').attr("href", "mailto:"+response.data.res.email+"?subject=Thank You!&body="+encodeURIComponent(response.data.emailData));
                            $('#toEmail').val(response.data.res.email);
                        $('textarea#rescomments').val(response.data.emailData);
                        $('#emailModal').modal() ///  
                    }

                }, function(err) {

                    if (err) {
                        //  alertify.delay(2000).error('There was an error preparing the email.');
                        toaster.pop('error', "Error", 'There was an error preparing the email.');
                    }
                })
                //$('#rescomments').val(comments);
                //$('#rescomments').attr('class',id);


        }

        $scope.SaveYG = function(data) {
            $http.post('/form/' + data.id + '/facility/', data).then(function(response) {
                if (response) {
                    //alertify.delay(2000).success('Success!');
                    toaster.pop('success', "Success", 'Success!');
                    $scope.generateEmailToResponder($scope.argu.model, $scope.argu.id, $scope.argu.responseid, $scope.argu.status);
                }

            }, function(err) {

                if (err) {
                    // alertify.delay(2000).error('There was an error updating Facility.');
                    toaster.pop('error', "Error", 'There was an error updating Facility.');
                }
            });
        }

        $scope.sendEmailToResponder = function() {
            console.log("We are going to send an email");
            var contents = $('textarea#rescomments').val();
            //sanitify check
            if (contents.length < 50) {
                //  alertify.delay(2000).error('The message was malformed. Did you send everything that you wanted to?');
                toaster.pop('error', "Error", 'The message was malformed. Did you send everything that you wanted to?');
                return;
            }
            if (contents.length > 5000) {
                //  alertify.delay(2000).error('The message was malformed. Try shortening your message.');
                toaster.pop('error', "Error", 'The message was malformed. Try shortening your message.');
                return;
            }

            $http.post('/form/' + $emailSelectedFormID + '/email/' + $emailSelectedResponseID, { email: contents }).then(function(response) {
                if (response.data) {
                    //alertify.delay(2000).success('Message sent!');
                    toaster.pop('success', "Success", 'Message sent!');

                }

            }, function(err) {

                if (err) {
                    //alertify.delay(2000).error('There was an error sending the email.');
                    toaster.pop('error', "Error", 'There was an error sending the email.');
                }
            });

        }

        // $scope.editFormResponse = function(id,comments,data) {
        //     $scope.textQuestions = [];
        //     $('#rescomments').val(comments);
        //     $('#rescomments').attr('class',id);
        //     $('#erModal').modal()
        //     console.log(id,comments)
        //     for(var i in data)      
        //                     {       
        //                         if(data[i].type=="text")        
        //                         {       
        //                          $scope.textQuestions.push({"id":data[i].id, "type":data[i].type, "text":data[i].text, "response_text":data[i].response_text, "response_rating":data[i].response_rating, "owner_id":data[i].owner_id, "formid":data[i].formid});     
        //                         }       
        //                     }
        // }

        $scope.editQuestionResponse = function(id, data) {
            $scope.text = data;
            $scope.text.responderid = id;
            // $('#rescomments').val(comments);
            // $('#rescomments').attr('class',id);
            $('#editModal').modal();
        }
        $scope.rateFunction = function(rating) {

        }

        $scope.updateFormResponse = function() {

            // var comments = $('#rescomments').val();
            // var id = $('#rescomments').attr('class');
            $http.post('/review/updateResponse', $scope.text).then(function(response) {

                if (response.data.updated) {
                    // alertify.delay(2000).success('Response Updated Successfully');
                    toaster.pop('success', "Success", 'Response Updated Successfully');
                    $('#editModal').modal('toggle');
                    $scope.formResponsesCount();
                    $scope.getFormResponses.reload();
                    $timeout(function() {
                        $scope.$apply();
                    }, 500)
                }

            }, function(err) {

                if (err) {
                    //  alertify.delay(2000).error('Oops! There was an error updating the response.');
                    toaster.pop('error', "Error", 'Oops! There was an error updating the response.');
                }
            })
        }
    }).directive('starRating', function() {
        return {
            restrict: 'EA',
            template: '<ul class="star-rating">' + '<li ng-repeat="star in stars" class="star" ng-class="{filled: star.filled}" ng-click="toggle($index)">' + '<i class="fa fa-star"></i>' + '</li>' + '</ul>',
            scope: {
                ratingValue: '=ngModel',
                max: '=?',
                onRatingSelect: '&?',
                readonly: '=?'
            },
            link: function(scope, elem, attrs) {
                if (scope.max == undefined) {
                    scope.max = 5;
                }
                var updateStars = function() {
                    scope.stars = [];
                    for (var i = 0; i < scope.max; i++) {
                        scope.stars.push({
                            filled: i < scope.ratingValue
                        });
                    }
                };

                scope.toggle = function(index) {
                    scope.ratingValue = index + 1;
                    scope.onRatingSelect({
                        rating: index + 1
                    });
                };

                scope.$watch('ratingValue',
                    function(oldVal, newVal) {
                        if (newVal) {
                            updateStars();
                        }
                    });
            }
        };
    }).directive('myMaxlength', ['$compile', '$log', function($compile, $log) {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {
                attrs.$set("ngTrim", "false");
                var maxlength = parseInt(attrs.myMaxlength, 10);
                ctrl.$parsers.push(function(value) {
                    $log.info("In parser function value = [" + value + "].");
                    if (value.length > maxlength) {
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
    }])
