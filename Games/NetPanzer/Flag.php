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

class Games_NetPanzer_Flag {
	var $conf;
	var $mapping;

	function Games_NetPanzer_Flag ($conf) {
		$this->setConf ($conf);
		$this->createMappingArray ();
	}
	
	function isFlagID ($flagID) {
		return isset ($this->mapping[$flagID]);
	}
	
	function getFlagImage ($flagID) {
		if (!$this->isFlagID ($flagID)) {
			return "FlagID id not existant";
		}
		
		$file = $this->conf["flagfilesdir"] . $this->mapping[$flagID];
		return file_get_contents ($file);
	}
	
	function createMappingArray () {
		$dh = opendir($this->conf["flagfilesdir"]);
		#echo "<b>Logfiles:</b>\n";
		$flags = array ();
		$c = 0;
		while (($file = readdir($dh)) !== false) { 
			if (filetype($this->conf["flagfilesdir"] . $file) == "file" and substr_count ($file, ".".$this->conf["flagfiletype"])) {
				$flags[$c] = $file;
				$c++;
			}
		}
		$this->mapping = $flags;
	}
		
	function setConf ($conf) {
		$this->conf = $conf;	
	}
}

?>