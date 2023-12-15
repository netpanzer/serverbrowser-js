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

class Games_NetPanzer_Serverliste {
	var $masterservers;
	var $gameservers;
	
	function Games_NetPanzer_Serverliste () {
		$this->masterservers = array ();
		$this->gameservers = array ();
	}
	
	function addMaster ($host, $port = 28900) {
		$this->masterservers[$host . ":" . $port] = array ("host" => $host, "port"=>$port);
	}
	
	function emptyMasterList () {
		$this->masterservers = array ();
	}
	
	function isMaster ($host, $port = 28900) {
		return isset ($this->masterservers[$host . ":" . $port]);
	}
	
	function countMasterServers () {
		return count ($this->masterservers);
	}
	
	function delMaster ($host, $port = 28900) {
		if ($this->isMaster ($host, $port)) {
			unset ($this->masterservers[$host . ":" . $port]);
			return 1;
		} else {
			return 0;
		}
	}
	
	function getMasterServers () {
		return $this->masterservers;
	}
	
	function getGameServers () {
		return $this->gameservers;
	}
	
	function countGameServers ($onlyavialables = 1) {
		if ($onlyavialables == 1) {
			$count = 0;
			foreach ($this->gameservers as $gs) {
				if (isset ($gs["status"]["error"]) and $gs["status"]["error"] == "timeout") {
				} else {
					$count++;
				}
			}
			return $count;
		} else {
			return count ($this->gameservers);
		}
	}		
	
	function isGameServer ($host, $port = 3030) {
		return isset ($this->gameservers[$host .":". $port]);
	}
	
	function deleteGameServer ($host, $port = 3030) {
		if ($this->isGameServer ($host, $port)) {
			unset ($this->gameservers[$host .":". $port]);
		} else {
			return 0;
		}
	}
	
	function setGameServers ($gs) {
		$this->gameservers = $gs;
	}
	
	function addGameServer ($host, $port = 3030, $master = NULL) {
		$this->gameservers[$host.":".$port] = array ("host" => $host, "port" => $port);
		if ($master != NULL) {
			$this->gameservers[$host.":".$port]["masterserver"] = $master;
		}
	}
}

?>