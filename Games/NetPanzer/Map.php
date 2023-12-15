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

class Games_NetPanzer_Map {
	var $maps;
	var $conf;
	var $sizes;
	
	function Games_NetPanzer_Map ($conf) {
		$this->setMaps (array (
			"Bad Neuburg",
			"Cramped",
			"Duell",
			"Hill 221",
			"Open War",
			"Six Approaches",
			"The Valley",
			"Tight Quarters",
			"Two Villages"
		));
		$this->sizes = array (
			"realsize" => array ("x" => "2000", "y" => "2000"),
			"huge" => array ("x" => "200", "y" => "200"),
			"big" => array ("x" => "100", "y" => "100"),
			"middle" => array ("x" => "75", "y" => "75"),
			"tiny" => array ("x" => "50", "y" => "50")
		);
		$this->conf = $conf;
	}
	
	function setMaps ($maps) {
		$this->maps = array ();
		foreach ($maps as $map) {
			$this->maps[md5 ($map)] = $map;
		}
	}
	
	function isMap ($map) {
		return isset ($this->maps[md5($map)]);
	}
	
	function isSize ($size) {
		return isset ($this->sizes["$size"]);
	}
	
	function setSize ($size) {
		if ($this->isSize ($size)) {
			return $size;
		} else {
			return $this->conf["defaultsize"];
		}
	}
	
	function getCacheID ($map, $size) {
		return $this->conf["cacheidprefix"].$map.$size.$this->conf["imageoutputtype"];
	}
	
	function getImage ($map, $size) {
		$rawimgfile = $this->conf["mapdatadir"].$map.".".$this->conf["imagetype"];
		
		$maxx = $this->sizes[$size]["x"];
		$maxy = $this->sizes[$size]["y"];
		
		$tsize = getimagesize ($rawimgfile);
		$oldx = $tsize[0];
		$oldy = $tsize[1];
		
		// resize algorythm:
		$newx = $oldx;
		$newy = $oldy;
		if ($oldx > $maxx or $oldy > $maxy) {
		    $ratio = $oldy / $oldx;
		    if ($oldx > $maxx) {
		        $newx = $maxx;
			        $newy = $maxx * $ratio;
		    }
		    if ($newy > $maxy) {
		        $newy = $maxy;
		        $newx = $maxy * (1 / $ratio);
		    }
		    $newx = round ($newx);
		    $newy = round ($newy);
		}
	    $oldimgres = imagecreatefrompng ($rawimgfile);
		
		// "deployment":
		$newimgres = imagecreatetruecolor ($newx,$newy);
		imagecopyresampled ($newimgres, $oldimgres, 0,0, 0, 0, $newx, $newy, $oldx, $oldy);
		
		$tempfilename = $this->conf["tempdir"].md5 ($map.$size).".tmp";
		
		if ($this->conf["imageoutputtype"] == "png") {
			imagepng ($newimgres, $tempfilename); 
		} elseif ($this->conf["imageoutputtype"] == "jpg") {
			imagejpeg ($newimgres, $tempfilename, 90); 
		}
		
		$data = file_get_contents ($tempfilename);
		unlink ($tempfilename);
		return $data;
	}
	
	function getOutposts ($map) {
		$optfile = $this->conf["mapdatadir"].$map.".opt";
		$outpostfile = file ($optfile);
		
		$outposts["number"] = str_replace (array ("ObjectiveCount: ", "\n"), array ("",""), $outpostfile[0]);
		$outposts["names"] = array ();
		
		$i = 2;
		while (isset ($outpostfile[$i])) {
			$name = str_replace (array ("Name: ", "\n"), array ("", ""), $outpostfile[$i]);
			if (strlen ($name) > 0) {
				$outposts["names"][] = $name;
			}
			$i += 3;
		}
		
		return $outposts;
	}
	
	function getSpawns ($map) {
		$spnfile = $this->conf["mapdatadir"].$map.".spn";
		$spawnfile = file ($spnfile);
		
		$spawns["number"] = str_replace (array ("SpawnCount: ", "\n"), array ("",""), $spawnfile[0]);
		
		return $spawns;
	}
	
	function getCacheConf () {
		return array (
			'cacheDir' => $this->conf["cachedir"],
			'lifeTime' => $this->conf["cachelifetime"]
		);
	}
	
	function getCtypeHeader () {
		if ($this->conf["imageoutputtype"] == "png") {
			return "Content-Type: image/png";
		} elseif ($this->conf["imageoutputtype"] == "jpg") {
			return "Content-Type: image/jpeg";
		} else {
			return "Content-Type: text/plain";
		}
	}
}

?>