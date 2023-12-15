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

/* * php - netPanzer - Browser
*	
* Configuration data. Page specific data lies in each file.
*
* * Configuration:
*
* Please note:	  All times are seconds.
*/
$conf = array (
	"includepath" =>	"./",
		// Basic path to includes (Classes, etc.).
	"smartyclass" =>	"./include/smarty/Smarty.class.php",
		// Path to the smarty class.
	"cachedir" => 		"./cache/lite_cache/",
		// Path where cache data (using PEAR Lite_Cache) gets stored.
	"templatedir" => 	"./templates/",
		// Directory where templates reside.
	"templatecachedir" => "./cache/templates_c/",
		// Templatesystems cache directory.
	"mapdatadir" => 	"./data/maps/",
		// Directory where map-data (images,...) lies.
	"flagfilesdir" =>	"./data/flags/",
		// Diretory where flag images reside.
	"tempdir" => 		"./cache/",
		// Diretory for temporary data.
	"imagetype" => 		"png",
		// Map image file type.
	"logfilesdir" => 	"./data/logs/",
		// Folder with raw logs.
	"flagfiletype" =>	"png",
		// Flags file type.
	"tankfilesdir" =>	"./data/tanks/",
		// Tank-image dir.
	"tankimagetype" => 	"jpg",
		// Tank-image type.
);

?>