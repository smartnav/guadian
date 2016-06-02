window.OSREV = window.OSREV || {};

window.OSREV.Dashboard = {
  init: function(url) {
    $('.approve').click(function() {
      var me = this;
      me.disabled = 'disabled';
      $.post(url + '/review/approve', {id: this.dataset.id}, function() {
        $(me).replaceWith('Approved');
      }).fail(function() {
        $(me).disabled = false; 
        alert('There was an issue approving the review.');
      });
    });
  }
};
