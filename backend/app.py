
import time
import sys, os
import os.path
import serial
import socket
import argparse
import webbrowser
import wsgiref.simple_server
from bottle import *
from serial_manager import SerialManager
from flash import flash_upload


VERSION = "v12.03a"
SERIAL_PORT = None
BITSPERSECOND = 9600
NETWORK_PORT = 4444
CONFIG_FILE = "lasaurapp.conf"
GUESS_PPREFIX = "tty.usbmodem"
COOKIE_KEY = 'secret_key_jkn23489hsdf'



def data_root():
    """This is to be used with all relative file access.
       _MEIPASS is a special location for data files when creating
       standalone, single file python apps with pyInstaller.
       Standalone is created by calling from 'other' directory:
       python pyinstaller/pyinstaller.py --onefile app.spec
    """
    if hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    else:
        # root is one up from this file
        return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../'))



def run_with_callback(host):
    """ Start a wsgiref server instance with control over the main loop.
        This is a function that I derived from the bottle.py run()
    """
    handler = default_app()
    server = wsgiref.simple_server.make_server(host, NETWORK_PORT, handler)
    server.timeout = 0.01
    print "-----------------------------------------------------------------------------"
    print "Bottle server starting up ..."
    print "Serial is set to %d bps" % BITSPERSECOND
    print "Point your browser to: "    
    print "http://%s:%d/      (local)" % ('127.0.0.1', NETWORK_PORT)    
    if host == '':
        print "http://%s:%d/   (public)" % (socket.gethostbyname(socket.gethostname()), NETWORK_PORT)
    print "Use Ctrl-C to quit."
    print "-----------------------------------------------------------------------------"    
    print
    try:
        webbrowser.open_new_tab('http://127.0.0.1:'+str(NETWORK_PORT))
    except webbrowser.Error:
        print "Cannot open Webbrowser, please do so manually."
    while 1:
        try:
            SerialManager.send_queue_as_ready()
            server.handle_request()
        except KeyboardInterrupt:
            break
    print "\nShutting down..."
    SerialManager.close()

        

@route('/hello')
def hello_handler():
    return "Hello World!!"

@route('/longtest')
def longtest_handler():
    fp = open("longtest.ngc")
    for line in fp:
        SerialManager.queue_for_sending(line)
    return "Longtest queued."
    


@route('/css/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(data_root(), 'frontend/css'))
    
@route('/js/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(data_root(), 'frontend/js'))
    
@route('/img/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(data_root(), 'frontend/img'))

@route('/')
@route('/index.html')
@route('/app.html')
def default_handler():
    return static_file('app.html', root=os.path.join(data_root(), 'frontend') )

@route('/canvas')
def default_handler():
    return static_file('testCanvas.html', root=os.path.join(data_root(), 'frontend'))    

@route('/serial/:connect')
def serial_handler(connect):
    if connect == '1':
        print 'js is asking to connect serial'      
        if not SerialManager.is_connected():
            try:
                global SERIAL_PORT, BITSPERSECOND
                SerialManager.connect(SERIAL_PORT, BITSPERSECOND)
                ret = "Serial connected to %s:%d." % (SERIAL_PORT, BITSPERSECOND)  + '<br>'
                time.sleep(1.0) # allow some time to receive a prompt/welcome
                SerialManager.flush_input()
                SerialManager.flush_output()
                return ret
            except serial.SerialException:
                print "Failed to connect to serial."    
                return ""          
    elif connect == '0':
        print 'js is asking to close serial'    
        if SerialManager.is_connected():
            if SerialManager.close(): return "1"
            else: return ""  
    elif connect == "2":
        print 'js is asking if serial connected'
        if SerialManager.is_connected(): return "1"
        else: return ""
    else:
        print 'ambigious connect request from js: ' + connect            
        return ""
        

@route('/gcode/:gcode_line')
def gcode_handler(gcode_line):
    if SerialManager.is_connected():    
        print gcode_line
        SerialManager.queue_for_sending(gcode_line)
        return "Queued for sending."
    else:
        return ""

@route('/gcode', method='POST')
def gcode_handler_submit():
    gcode_program = request.forms.get('gcode_program')
    if gcode_program and SerialManager.is_connected():
        lines = gcode_program.split('\n')
        print "Adding to queue %s lines" % len(lines)
        for line in lines:
            SerialManager.queue_for_sending(line)
        return "Queued for sending."
    else:
        return ""

@route('/queue_pct_done')
def queue_pct_done_handler():
    return SerialManager.get_queue_percentage_done()


# @route('/svg_upload', method='POST')
# # file echo - used as a fall back for browser not supporting the file API
# def svg_upload():
#     data = request.files.get('data')
#     if data.file:
#         raw = data.file.read() # This is dangerous for big files
#         filename = data.filename
#         print "You uploaded %s (%d bytes)." % (filename, len(raw))
#         return raw
#     return "You missed a field."



# def check_user_credentials(username, password):
#     return username in allowed and allowed[username] == password
#     
# @route('/login')
# def login():
#     username = request.forms.get('username')
#     password = request.forms.get('password')
#     if check_user_credentials(username, password):
#         response.set_cookie("account", username, secret=COOKIE_KEY)
#         return "Welcome %s! You are now logged in." % username
#     else:
#         return "Login failed."
# 
# @route('/logout')
# def login():
#     username = request.forms.get('username')
#     password = request.forms.get('password')
#     if check_user_credentials(username, password):
#         response.delete_cookie("account", username, secret=COOKIE_KEY)
#         return "Welcome %s! You are now logged out." % username
#     else:
#         return "Already logged out."


### Setup Argument Parser
argparser = argparse.ArgumentParser(description='Run LasaurApp.', prog='lasaurapp')
argparser.add_argument('port', metavar='serial_port', nargs='?', default=False,
                    help='serial port to the Lasersaur')
argparser.add_argument('-v', '--version', action='version', version='%(prog)s ' + VERSION)
argparser.add_argument('-p', '--public', dest='host_on_all_interfaces', action='store_true',
                    default=False, help='bind to all network devices (default: bind to 127.0.0.1)')
argparser.add_argument('-f', '--flash', dest='build_and_flash', action='store_true',
                    default=False, help='flash Arduino with LasaurGrbl firmware')
argparser.add_argument('-l', '--list', dest='list_serial_devices', action='store_true',
                    default=False, help='list all serial devices currently connected')
argparser.add_argument('-d', '--debug', dest='debug', action='store_true',
                    default=False, help='print more verbose for debugging')
args = argparser.parse_args()


if args.list_serial_devices:
    SerialManager.list_devices()
else:
    if args.port:
        # (1) get the serial device from the argument list
        SERIAL_PORT = args.port
        print "Using serial device '"+ SERIAL_PORT +"' from command line."
    else:    
        if os.path.isfile(CONFIG_FILE):
            # (2) get the serial device from the config file
            fp = open(CONFIG_FILE)
            line = fp.readline().strip()
            if len(line) > 3:
                SERIAL_PORT = line
                print "Using serial device '"+ SERIAL_PORT +"' from '" + CONFIG_FILE + "'."
            
    if not SERIAL_PORT:
        # (3) try best guess the serial device if on linux or osx
        # if os.path.isdir("/dev"):
        #     devices = os.listdir("/dev")
        #     for device in devices:
        #         if device[:len(GUESS_PPREFIX)] == GUESS_PPREFIX:
        #             SERIAL_PORT = "/dev/" + device
        #             print "Using serial device '"+ SERIAL_PORT +"' by best guess."
        #             break
        if os.name == 'nt': #sys.platform == 'win32':    
            SERIAL_PORT = SerialManager.match_device('Arduino')
        elif os.name == 'posix':
            SERIAL_PORT = SerialManager.match_device(GUESS_PPREFIX)
        if SERIAL_PORT:
            print "Using serial device '"+ str(SERIAL_PORT) +"' by best guess."
    
    if SERIAL_PORT:
        if args.debug and hasattr(sys, "_MEIPASS"):
            print "Data root is: " + sys._MEIPASS        
        if args.build_and_flash:
            flash_upload(SERIAL_PORT, data_root())
        else:
            # debug(True)
            if args.host_on_all_interfaces:
                run_with_callback('')
            else:
                run_with_callback('127.0.0.1')
    else:         
        print "-----------------------------------------------------------------------------"
        print "ERROR: LasaurApp doesn't know what serial device to connect to!"
        print "On Linux or OSX this is something like '/dev/tty.usbmodemfd121' and on"
        print "Windows this is something like 'COM1', 'COM2', 'COM3', ..."
        print "The serial port can be supplied in one of the following ways:"
        print "(1) First argument on the  command line."
        print "(2) In a config file named '" + CONFIG_FILE + "' (located in same directory)"
        print "    with the serial port string on the first line."
        print "(3) Best guess. On Linux and OSX the app can guess the serial name by"
        print "    choosing the first device it finds starting with '"+ GUESS_PPREFIX +"'."
        print "-----------------------------------------------------------------------------"

