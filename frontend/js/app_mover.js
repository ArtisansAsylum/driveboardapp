
var gcode_coordinate_offset = undefined;

function reset_offset() {
  $("#offset_area").hide();
  $('#offset_area').css({'opacity':0.0, left:0, top:0});
  gcode_coordinate_offset = undefined;
  $("#cutting_area").css('border', '1px dashed #ff0000');
  $("#offset_area").css('border', '1px dashed #aaaaaa');
  send_gcode('G54\n', "Offset reset.", false);
  $('#coordinates_info').text('');
}



///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////



$(document).ready(function(){

  $('#cutting_area').height(app_settings.canvas_dimensions[1]);
  $('#x_location_field').val('');
  $('#y_location_field').val('');

  var isDragging = false;
  
  function assemble_and_send_gcode(x, y, do_not_scale) {
    // x or y can be NaN or null
    // this allows for moving only along x or y
    var x_phy;
    var y_phy;
    if (do_not_scale == null || do_not_scale === false) {
      x_phy = x*app_settings.to_physical_scale;
      y_phy = y*app_settings.to_physical_scale;
    } else {
      x_phy = x;
      y_phy = y;
    }
    /// contrain
    if (x_phy < 0) {
      x_phy = 0;
      $().uxmessage('warning', "x target constrained to work area");
    } else if (x_phy > app_settings.work_area_dimensions[0]) {
      x_phy = app_settings.work_area_dimensions[0];
      $().uxmessage('warning', "x target constrained to work area");
    }
    if (y_phy < 0) {
      y_phy = 0;
      $().uxmessage('warning', "y target constrained to work area");
    } else if (y_phy > app_settings.work_area_dimensions[1]) {
      y_phy = app_settings.work_area_dimensions[1];
      $().uxmessage('warning', "y target constrained to work area");
    }
    var feedrate = parseFloat(DataHandler.mapConstrainFeedrate($("#feedrate_field" ).val()));

    var job = {
      "vector":{
        "passes":[
          {
            "paths":[0],
            "seekrate":feedrate
          }
        ],
        "paths":[
          [
            [[x_phy,y_phy,0.0]]
          ]
        ],
        "noreturn": true,
      }
    }
    send_job(job, "Motion request sent.", false);
  }
  
  function assemble_info_text(x,y) {
    var x_phy = x*app_settings.to_physical_scale;
    var y_phy = y*app_settings.to_physical_scale;
    var coords_text;
    var move_or_cut = 'move';
    if($('#feed_btn').hasClass("active")){
      move_or_cut = 'cut';
    }
    var feedrate = DataHandler.mapConstrainFeedrate($( "#feedrate_field" ).val());
    var intensity =  DataHandler.mapConstrainIntesity($( "#intensity_field" ).val());
    var coords_text;
    if (move_or_cut == 'cut') {
      coords_text = move_or_cut + ' to (' + 
                    x_phy.toFixed(0) + ', '+ 
                    y_phy.toFixed(0) + ') at ' + 
                    feedrate + 'mm/min and ' + Math.round(intensity/2.55) + '% intensity';
    } else {
      coords_text = move_or_cut + ' to (' + x_phy.toFixed(0) + ', '+ 
                    y_phy.toFixed(0) + ') at ' + feedrate + 'mm/min'
    }
    return coords_text;
  }

  function assemble_offset_text(x,y) {
    var x_phy = x*app_settings.to_physical_scale;
    var y_phy = y*app_settings.to_physical_scale;
    return 'set offset to (' + x_phy.toFixed(0) + ', '+ y_phy.toFixed(0) + ')'
  }

  function assemble_and_set_offset(x, y) {
    if (x == 0 && y == 0) {
      reset_offset()
    } else {
      $("#offset_area").show();
      $("#offset_area").animate({
        opacity: 1.0,
        left: x,
        top: y,
        width: 609-x,
        height: 304-y
      }, 200 );
      gcode_coordinate_offset = [x,y];
      var x_phy = x*app_settings.to_physical_scale + app_settings.table_offset[0];
      var y_phy = y*app_settings.to_physical_scale + app_settings.table_offset[1];
      var gcode = 'G10 L2 P1 X'+ x_phy.toFixed(app_settings.num_digits) + 
                  ' Y' + y_phy.toFixed(app_settings.num_digits) + '\nG55\n';
      send_gcode(gcode, "Offset set.", false);
      $(this).css('border', '1px dashed #aaaaaa');
      $("#offset_area").css('border', '1px dashed #ff0000');
    }
  }
  


  
  $("#cutting_area").mousedown(function() {
    isDragging = true;
  }).mouseup(function() {
    isDragging = false;
  });
  

  $("#cutting_area").click(function(e) {
    var offset = $(this).offset();
    var x = (e.pageX - offset.left);
    var y = (e.pageY - offset.top);

    if(e.shiftKey) {
      assemble_and_set_offset(x,y);
    } else if (!gcode_coordinate_offset) {  
      assemble_and_send_gcode(x,y);
    } else {
      var pos = $("#offset_area").position()
      if ((x < pos.left) || (y < pos.top)) {       
        //// reset offset
        reset_offset();
      }
    }
    return false;
  });


  $("#cutting_area").hover(
    function () {
      if (!gcode_coordinate_offset) {
        $(this).css('border', '1px dashed #ff0000');
      }
      $(this).css('cursor', 'crosshair');
    },
    function () {
      $(this).css('border', '1px dashed #aaaaaa');
      $(this).css('cursor', 'pointer'); 
      $('#coordinates_info').text('');    
    }
  );
  
  $("#cutting_area").mousemove(function (e) {
    var offset = $(this).offset();
    var x = (e.pageX - offset.left);
    var y = (e.pageY - offset.top);
    if (!gcode_coordinate_offset) {
      if(!e.shiftKey) {
        coords_text = assemble_info_text(x,y);
        if (e.altKey &&isDragging) {
            assemble_and_send_gcode(x,y);
        }
      } else {
        coords_text = assemble_offset_text(x,y);
      }
    } else {
      if(e.shiftKey) {
        coords_text = 'set offset to (' + x + ', '+ y + ')'
      } else {
        var pos = $("#offset_area").position()
        if ((x < pos.left) || (y < pos.top)) {           
          coords_text = 'click to reset offset';
        } else {
          coords_text = '';
        }
      }
    }
    $('#coordinates_info').text(coords_text);
  });
  
  
  $("#offset_area").click(function(e) { 
    if(!e.shiftKey) {
      var offset = $(this).offset();
      var x = (e.pageX - offset.left);
      var y = (e.pageY - offset.top);     
      assemble_and_send_gcode(x,y);
      return false
    }
  });

  $("#offset_area").hover(
    function () {
    },
    function () {
      $('#offset_info').text('');   
    }
  );
  
  $("#offset_area").mousemove(function (e) {
    if(!e.shiftKey) {
      var offset = $(this).offset();
      var x = (e.pageX - offset.left);
      var y = (e.pageY - offset.top);
      $('#offset_info').text(assemble_info_text(x,y));
    } else {
      $('#offset_info').text('');
    }
  });
  
  
  /// motion parameters /////////////////////////

  $("#intensity_field" ).val('0');
  $("#feedrate_field" ).val(app_settings.max_seek_speed);
  
  $("#seek_btn").click(function(e) {
    $("#intensity_field" ).hide();
    $("#intensity_field_disabled" ).show();
    $('#loc_move_cut_word').html('Move');
  });  
  $("#feed_btn").click(function(e) {
    $("#intensity_field_disabled" ).hide();
    $("#intensity_field" ).show();
    $('#loc_move_cut_word').html('Cut');
  });   
  
  $("#feedrate_btn_slow").click(function(e) {
    $("#feedrate_field" ).val("600");
  });  
  $("#feedrate_btn_medium").click(function(e) {
    $("#feedrate_field" ).val("2000");
  });  
  $("#feedrate_btn_fast").click(function(e) {
    $("#feedrate_field" ).val(app_settings.max_seek_speed);
  });  
  $("#feedrate_field").focus(function(e) {
    $("#feedrate_btn_slow").removeClass('active');
    $("#feedrate_btn_medium").removeClass('active');
    $("#feedrate_btn_fast").removeClass('active');
  });
  
  if ($("#feedrate_field" ).val() != app_settings.max_seek_speed) {
    $("#feedrate_btn_slow").removeClass('active');
    $("#feedrate_btn_medium").removeClass('active');
    $("#feedrate_btn_fast").removeClass('active');    
  }
  

  /// jog buttons ///////////////////////////////

  $("#jog_up_btn").click(function(e) {
    send_relative_move(0,-10,0, 6000, "Moving Up ...");
  });   
  $("#jog_left_btn").click(function(e) {
    send_relative_move(-10,0,0, 6000, "Moving Left ...");
  });   
  $("#jog_right_btn").click(function(e) {
    send_relative_move(10,0,0, 6000, "Moving Right ...");
  });
  $("#jog_down_btn").click(function(e) {
    send_relative_move(0,10,0, 6000, "Moving Down ...");
  });


  /// jog keys //////////////////////////////////

  $(document).on('keydown', null, 'right', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(10,0,0, 6000, "Moving Right ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+right', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(2,0,0, 6000, "Moving Right ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+right', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(50,0,0, 6000, "Moving Right ...");
      return false;
    }
  });

  $(document).on('keydown', null, 'left', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(-10,0,0, 6000, "Moving Left ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+left', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(-2,0,0, 6000, "Moving Left ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+left', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(-50,0,0, 6000, "Moving Left ...");
      return false;
    }
  });

  $(document).on('keydown', null, 'up', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(0,-10,0, 6000, "Moving Up ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+up', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(0,-2,0, 6000, "Moving Up ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+up', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(0,-50,0, 6000, "Moving Up ...");
      return false;
    }
  });

  $(document).on('keydown', null, 'down', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(0,10,0, 6000, "Moving Down ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'alt+down', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(0,2,0, 6000, "Moving Down ...");
      return false;
    }
  });
  $(document).on('keydown', null, 'shift+down', function(e){
    if ($('#tab_mover').is(":visible")) {
      send_relative_move(0,50,0, 6000, "Moving Down ...");
      return false;
    }
  });
      

  /// numeral location buttons //////////////////
  $("#location_set_btn").click(function(e) {
    var x = parseFloat($('#x_location_field').val());
    var y = parseFloat($('#y_location_field').val());
    // NaN from parsing '' is ok
    assemble_and_send_gcode(x, y, true);
  }); 

  $("#origin_set_btn").click(function(e) {
    var x_str = $('#x_location_field').val();
    if (x_str == '') {
      x_str = '0';
    }
    var x = parseFloat(x_str)*app_settings.to_canvas_scale;
    var y_str = $('#y_location_field').val();
    if (y_str == '') {
      y_str = '0';
    }
    var y = parseFloat(y_str)*app_settings.to_canvas_scale;
    assemble_and_set_offset(x, y);
  });  


  /// air assist buttons ////////////////////////

  $("#air_on_btn").click(function(e) {
    var gcode = 'M80\n';
    send_gcode(gcode, "Air assist on ...", false) 
  });  
  $("#air_off_btn").click(function(e) {
    var gcode = 'M81\n';
    send_gcode(gcode, "Air assist off ...", false) 
  });
});  // ready
