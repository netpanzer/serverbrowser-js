<?php
/*
Copyright (C) 2004 Tobias Blersch <npb@schrelb.de>
                                                                                
This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.
                                                                                
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
                                                                                
You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

class Games_NetPanzer_Gameserver {
	var $server;
		// = array ("host", "port")
	var $socket;
	var $timeout;
	
	function Games_NetPanzer_Gameserver ($server = NULL) {
		$this->socket = NULL;
		$this->timeout = 2;
		if ($server != NULL) {
			$ret = $this->connect ($server);
			if (is_array ($ret)) {
				print_r ($ret);
			}
		}
	}
	
	function reset ($server) {
		$this->disconnect ();
		$this->connect ($server);
	}
	
	function connect ($server) {
		$errno = 0;
		$errstr = "";
		$sck = fsockopen ("udp://".$server["host"], $server["port"], $errno, $errstr, $this->timeout);
		stream_set_timeout ($sck, $this->timeout);

		if (!$sck) {
			return array ("errno"=>$errno, "errstr"=>$errstr, "server"=>$server);
		} else {
			$this->socket = $sck;
			return 0;
		}
	}
	
	function disconnect () {
		if ($this->socket != NULL) {
			fclose ($this->socket);
			$this->socket = NULL;
		}
	}
	
	function getStatus () {
		$query = "\\status\\final\\";
		$q = $this->query ($query);
		$q = str_replace ("\\final\\", "", $q);
		$r = explode ("\\", $q);
		
		$vals = array ();
		$p = 0;
		while (true) {
			if (!isset ($r[$p]) or !isset ($r[$p+1])) {
				break;
			}
			if (strstr ($r[$p], "_")) {
				$parts = explode ("_", $r[$p]);
				if (is_numeric ($parts[1])) {
					#$vals["player_".$parts[1]][$parts[0]] = $r[$p+1];
					$vals["players"]["{$parts[1]}"][$parts[0]] = $r[$p+1];
				} else {
					$vals[$r[$p]] = $r[$p+1];
				}
			} else {
				$vals[$r[$p]] = $r[$p+1];
			}
			$p += 2;
		}
		if ($vals == array ()) {
			$vals = array ("error"=>"timeout");
		}
		
		return $vals;
	}
	
	function query ($query) {
		if ($this->socket == NULL) {
			return 0;
		}
		fputs ($this->socket, $query);
		
		$return = "";
		while (false !== ($char = fgetc($this->socket))) { 
			$return .= $char;
			if (strstr ($return, "\\final\\")) {
				break;
			}
		}
		
		return $return;
	}
	
	function setTimeout ($timeout) {
		$this->timeout = $timeout;
	}
}
?>