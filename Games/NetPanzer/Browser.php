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

require_once ("Masterserver.php");
require_once ("Gameserver.php");
require_once ("Serverliste.php");

class Games_NetPanzer_Browser extends Games_NetPanzer_Serverliste {
	var $timeout;
	var $maps;

	function Games_NetPanzer_Browser () {
		$this->Games_NetPanzer_Serverliste ();
		$this->timeout = 2;
		$this->maps = array ();
	}
	
	function Browse () {
		$masters = $this->getMasterServers ();
		$this->emptyMasterList ();
		$masterstack = array ();
		foreach ($masters as $master) {
			array_push ($masterstack, $master);
		}
		
		while (count ($masterstack) > 0) {
			$currentm = array_pop ($masterstack);
			if (!$this->isMaster ($currentm["host"], $currentm["port"])) {
				$browser = new Games_NetPanzer_Masterserver ($currentm["host"], $currentm["port"]);
				$browser->setTimeout ($this->timeout);
				if ($browser->isConnected ()) {
					$this->addMaster ($currentm["host"], $currentm["port"]);
					$masterlist = $browser->getMasters ();
					foreach ($masterlist as $amaster) {
						if (!$this->isMaster ($amaster["host"], $amaster["port"])) {
							array_push ($masterstack, $amaster);
						}
					}
					$games = $browser->getGames ();
					foreach ($games as $agame) {
						if (!$this->isGameServer ($agame["host"], $agame["port"])) {
							$this->gameservers[$agame["host"].":".$agame["port"]] = $agame;
							$this->gameservers[$agame["host"].":".$agame["port"]]["masterserver"] = $currentm;
						}
					}
					$browser->disconnect ();
				}
				unset ($browser);
			}
		}
	}
	
	function getGameserversStatus () {
		// Query each gameserver.
		$gq = new Games_NetPanzer_Gameserver ();
		$gq->setTimeout ($this->timeout);
		foreach ($this->gameservers as $gkey=>$game) {
			$gq->reset ($game);
			$this->gameservers[$gkey]["status"] = $gq->getStatus ();
		}
		$gq->disconnect ();
	}
	
	function setTimeout ($timeout) {
		$this->timeout = $timeout;
	}
}

?>