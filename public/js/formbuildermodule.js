(function() {
    'use strict';

angular
.module('formbuilder',['ngAlertify','ngAnimate','toaster'])
.service('QuestionsListService',QuestionsListService)
.service('QuestionsSaveService',QuestionsSaveService)
.service('QuestionsRemoveService',QuestionsRemoveService)
.controller('FormBuilderController',FormBuilderController)




function QuestionsListService($http) {

    var ref = this;

    this.questions = [{'question':'In recommending this facility to your friends and family, how would you rate it overall?','qtype':'range','orderid':0,'is_hide':false},
                      {'question':'Overall, how would you rate the staff?','qtype':'range','orderid':1,'is_hide':false},
                      {'question':'How would you rate the care you received?','qtype':'range','orderid':2,'is_hide':false},
                      {'question':'How would you rate how well your discharge needs were met?','qtype':'range','orderid':3,'is_hide':false},
                      {'question':'Do you have any other comments you would like to share?','qtype':'text','orderid':4,'is_hide':false}]
    this.getQuestionsList = function(formId) {
        
       return $http.post('/formbuilder/list',{formId:formId},{timeout: 5000});

    }

    this.defaultQuestions = function() {

        return this.questions;

    }

    this.isResponseReceived = function(formId) {

        return $http.post('/formbuilder/isresponsereceived',{formId:formId},{timeout: 5000});
    }
}

QuestionsListService.$inject = ['$http']

function QuestionsSaveService($http,qls) {

    var ref = this;

    this.create = function(param) {

        return $http.post('/formbuilder/save',param,{timeout: 5000});
    }

    this.isQuestionExist = function(formid) {

        return $http.post('/formbuilder/isquestionexist',{formId:formid},{timeout: 5000}).then(function(res){

            if(res.data.total==0){

                ref.defaultSave(formid);
            }
        })
    }

    this.defaultSave = function(formid) {


        var arr = qls.defaultQuestions();
        arr[0]['formId'] = formid
        arr[1]['formId'] = formid
        arr[2]['formId'] = formid
        arr[3]['formId'] = formid
        arr[4]['formId'] = formid

        $('#loadingdiv').addClass('loading')
        ref.create(arr[0])
        .then(function(one){

            return ref.create(arr[1])
        })
        .then(function(two){

            return ref.create(arr[2])
        })
        .then(function(three){

            return ref.create(arr[3])
        })
        .then(function(four){

            return ref.create(arr[4])
        })
        .then(function(five) {

            console.log('Default Questions Created')
            $('#loadingdiv').removeClass('loading')
        })

    }

}

QuestionsSaveService.$inject = ['$http','QuestionsListService']



function QuestionsRemoveService($http) {

    var ref = this;

    this.remove = function(param) {

        return $http.post('/formbuilder/remove',param,{timeout: 5000});
    }

}

QuestionsRemoveService.$inject = ['$http'];


function FormBuilderController($timeout,qls,qss,qrs,alertify) {

    var vm                  = this;
    vm.questions            = [];
    vm.haveResponse         = true;
    vm.init                 = init;
    vm.addQuestion          = addQuestion;
    vm.listQuestions        = listQuestions;
    vm.saveQuestion         = saveQuestion;
    vm.removeQuestion       = removeQuestion;
    vm.disableFields        = disableFields;
    vm.validateQuestions    = validateQuestions;
    vm.beforeAfterSave      = beforeAfterSave;
    vm.preloaderStart       = preloaderStart;
    vm.preloaderStop        = preloaderStop;
    vm.findNextIndex        = findNextIndex;
    vm.isResponseReceived   = isResponseReceived;


    function init() {

        $timeout(function(){qss.isQuestionExist(vm.formId);},500)
        $('#loadingdiv').addClass('loading') 
        $timeout(function(){
            isResponseReceived(vm.formId);
            listQuestions(vm.formId);
            alertify.logPosition('bottom-right').delay(2000);
            $('#loadingdiv').removeClass('loading')
        },1000) 
    }

    function disableFields() {

        $('.fa-refresh').hide();
        
    }

    function isResponseReceived() {

        var startSecond = new Date().getSeconds();
        vm.preloaderStart();
        var promise = qls.isResponseReceived(vm.formId);
        promise.then(function(response){

            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')

            vm.preloaderStop()            
            if(response.data.total=='0') {
                $timeout(function(){
                    $('select').attr('disabled', false);
                    vm.haveResponse = false

                },1000)
            }
            else {

                $timeout(function(){
                    $('select').attr('disabled', 'disabled');
                    vm.haveResponse = true

                },1000)
                
            }

        },function(error){

            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')

            vm.preloaderStop()  
        })
    }
        
    function preloaderStart() {

        $('#loadingdiv').addClass('loading')
    }

    function preloaderStop() {

        $('#loadingdiv').removeClass('loading')
    }

    function isEditable() {

    }

    function listQuestions(formId) {

        var startSecond = new Date().getSeconds();
        vm.preloaderStart();
        $timeout(function(){ vm.disableFields(); }, 500)
        var promise = qls.getQuestionsList(vm.formId);
        promise.then(function(response){
            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')

            vm.questions = response.data;
            vm.preloaderStop()
        },
        function(err){
            vm.questions = qls.defaultQuestions();
            vm.preloaderStop();
            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')
        })

    }

    function findNextIndex() {

        var arr = vm.questions.map(function(quest) {
            return quest.orderid;
        })
        var nxt = arr[arr.length-1];
        return nxt += 1;
    }

    function addQuestion() {
        vm.questions.push({'question':'','qtype':'','orderid':vm.findNextIndex(),'is_hide':false});
    }

    function validateQuestions(id) {

        if($("#"+id+" input").val()=='') {
        alertify.error('Question Should not be Empty');
        return false;
        }
        if($("#"+id+" select").val()=='') {
        alertify.error('Type Should not be Empty');
        return false;
        }
        if($("#"+id+" input").val()!='' && $("#"+id+" select").val()!=''){
            $('#'+id+' .fa-floppy-o').css('color','green')
            return true;
        }
        return false;
    }
    
    function saveQuestion(id) {

        if(vm.validateQuestions(id)===false) return;

        var startSecond = new Date().getSeconds();
        vm.beforeAfterSave('before',id)
        console.log(id);
        console.log($("#"+id+" select[name = 'types']").val());
        var postData = {'question':$("#"+id+" input[type='text']").val(),'orderid':vm.questions[id]['orderid'],'formId':vm.formId,'qtype':$("#"+id+" select[name = 'types']").val(),'is_hide':$("#"+id+" select[name='is_hide']").val()};
        var promise = qss.create(postData);
        promise.then(function(response){

            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')
            else
                alertify.success('Question Saved Successfully');

            vm.beforeAfterSave('after',id)
            vm.init();

            
        },
        function(err){
            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')
            vm.init();
            vm.preloaderStop();
            
        })
    }

    function beforeAfterSave(when,id) {

        if(when=='before') {

            $('#'+id+' .fa-floppy-o').hide();
            $('#'+id+' .fa-refresh').show();
            $('#'+id+' .fa-trash-o').hide();
            vm.preloaderStart()
            
        }
        else {

            $('#'+id+' .fa-refresh').hide();
            $('#'+id+' .fa-floppy-o').show();
            $('#'+id+' .fa-trash-o').show();
            vm.preloaderStop();
        }

    }

    
    function removeQuestion(id) {


        var confrm = confirm("Are You Sure Want to Remove this?")
        if(confrm===false) {
            return;
        }
        vm.preloaderStart()
        var postData = {'orderid':vm.questions[id]['orderid'],'formId':vm.formId}
        var promise = qrs.remove(postData);
        var startSecond = new Date().getSeconds();
        promise.then(function(response){

            var endSecond = new Date().getSeconds();
                if(endSecond-startSecond>=5)
                    alert('Ooops, something went wrong')
                else
                    alertify.success('Question Removed Successfully');

            var orderid = response.data.orderid;
            vm.preloaderStop();
            if(orderid) {
                $('#'+orderid).remove();
                vm.init();
                
            }
            else {
                $('#'+id).remove();
                vm.preloaderStop();
                vm.init();
                
            }
        },
        function(err){

            var endSecond = new Date().getSeconds();
            if(endSecond-startSecond>=5)
                alert('Ooops, something went wrong')
            else
                alertify.success('Question Removed Successfully');

            var orderid = err.config.data.orderid;
            $('#'+orderid).remove();
            vm.preloaderStop()
            vm.init();
            

        })
    }



    init();

}

FormBuilderController.$inject = ['$timeout','QuestionsListService','QuestionsSaveService','QuestionsRemoveService','alertify'];

})();