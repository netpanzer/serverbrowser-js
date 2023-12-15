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

class Games_NetPanzer_Masterserver {
	var $master;
		// [] = array ("host", "port")
	var $socket;
	var $timeout;
	
	function Games_NetPanzer_Masterserver ($host, $port = 28900) {
		$this->socket = NULL;
		$this->timeout = 2;
		$this->master = array ("host" => $host, "port" => $port);
		$this->Connect ();
	}
	
	function isConnected () {
		if ($this->socket != NULL) {
			return 1;
		} else {
			return 0;
		}
	}
	
	function Connect () {
		if ($this->isConnected ()) {
			$this->Disconnect ();
		}
		$errno = 0;
		$errstr = "";
		$sck = @fsockopen ($this->master["host"], $this->master["port"], $errno, $errstr, $this->timeout);

		if (!$sck) {
			return array ("errno"=>$errno, "errstr"=>$errstr, "master"=>$this->master);
		} else {
			$this->socket = $sck;
			return 1;
		}
	}
	
	function Disconnect () {
		fclose ($this->socket);
		$this->socket = NULL;
	}
	
	function _list ($gamename, $options = array ()) {
		$query = "\\list\gamename\\" . $gamename . "\\";
		foreach ($options as $key => $val) {
			$query .= "$key\\$val\\";
		}
		$query .= "final\\";
		$q = $this->_query ($query);
		$q = str_replace ("\\final\\", "", $q);
		$r = explode ("\\", $q);
		
		$servers = array ();
				
		$pointer = 1;
		while (1) {
			if (isset ($r[$pointer])) {
				$servers[$r[$pointer+1]] = array ("host" => $r[$pointer+1], "port"=>$r[$pointer+3]);
				$pointer += 4;
			} else {
				break;
			}
		}
		return $servers;
	}
	
	function getMasters () {
		return $this->_list ("master");		
	}
	
	function getGames ($options = array ()) {
		return $this->_list ("netpanzer", $options);
	}
	
	function _query ($query) {
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