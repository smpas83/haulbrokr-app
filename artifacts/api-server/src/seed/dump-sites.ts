import { db, dumpSitesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const sites = [
  // Alabama
  { name: "Chastang Landfill", address: "3200 Chastang Rd", city: "Mobile", state: "AL", zip: "36605", type: "landfill" as const, phone: "(251) 221-5020" },
  { name: "Jefferson County Solid Waste", address: "716 Richard Arrington Jr Blvd N", city: "Birmingham", state: "AL", zip: "35203", type: "transfer_station" as const, phone: "(205) 325-5600" },
  { name: "Pine Bluff Landfill", address: "4200 Old Montgomery Hwy", city: "Montgomery", state: "AL", zip: "36116", type: "landfill" as const, phone: "(334) 240-4000" },
  { name: "Limestone County Landfill", address: "1325 Landfill Rd", city: "Athens", state: "AL", zip: "35611", type: "landfill" as const },
  { name: "Shelby County C&D Landfill", address: "200 Landfill Rd", city: "Pelham", state: "AL", zip: "35124", type: "construction_debris" as const, phone: "(205) 620-6400" },

  // Alaska
  { name: "Central Transfer Station", address: "3101 Peger Rd", city: "Fairbanks", state: "AK", zip: "99709", type: "transfer_station" as const, phone: "(907) 459-1140" },
  { name: "Anchorage Regional Landfill", address: "13400 Hiland Rd", city: "Eagle River", state: "AK", zip: "99577", type: "landfill" as const, phone: "(907) 343-6262" },
  { name: "Juneau Transfer Station", address: "1030 Anka St", city: "Juneau", state: "AK", zip: "99801", type: "transfer_station" as const, phone: "(907) 586-5226" },
  { name: "Palmer Transfer Facility", address: "1700 E Bogard Rd", city: "Palmer", state: "AK", zip: "99645", type: "transfer_station" as const },

  // Arizona
  { name: "Butterfield Station Landfill", address: "23575 S Ellsworth Rd", city: "Queen Creek", state: "AZ", zip: "85142", type: "landfill" as const, phone: "(480) 655-0016" },
  { name: "Tucson Transfer Station", address: "1110 W Silverlake Rd", city: "Tucson", state: "AZ", zip: "85713", type: "transfer_station" as const, phone: "(520) 791-5000" },
  { name: "SR-303 Landfill", address: "8701 W Pinnacle Peak Rd", city: "Peoria", state: "AZ", zip: "85382", type: "landfill" as const },
  { name: "Mesa C&D Landfill", address: "3050 N Lindsey Rd", city: "Mesa", state: "AZ", zip: "85213", type: "construction_debris" as const, phone: "(480) 644-3097" },
  { name: "Yuma County Landfill", address: "5200 E County 14th St", city: "Yuma", state: "AZ", zip: "85365", type: "landfill" as const },

  // Arkansas
  { name: "Little Rock Solid Waste", address: "11800 Colonel Glenn Rd", city: "Little Rock", state: "AR", zip: "72204", type: "landfill" as const, phone: "(501) 244-5340" },
  { name: "Fayetteville Transfer Station", address: "2275 N Oakland Ave", city: "Fayetteville", state: "AR", zip: "72703", type: "transfer_station" as const, phone: "(479) 575-8340" },
  { name: "Pulaski County Regional Landfill", address: "6901 Mabelvale Pike", city: "Little Rock", state: "AR", zip: "72209", type: "landfill" as const },
  { name: "Fort Smith Sanitation", address: "7701 Zero St", city: "Fort Smith", state: "AR", zip: "72903", type: "transfer_station" as const },

  // California
  { name: "Puente Hills Landfill", address: "2800 S Workman Mill Rd", city: "Whittier", state: "CA", zip: "90601", type: "landfill" as const, phone: "(562) 695-0522" },
  { name: "Altamont Landfill", address: "10840 Altamont Pass Rd", city: "Livermore", state: "CA", zip: "94551", type: "landfill" as const, phone: "(925) 456-2800" },
  { name: "Recology Golden Gate Transfer Station", address: "900 7th St", city: "San Francisco", state: "CA", zip: "94107", type: "transfer_station" as const, phone: "(415) 330-1400" },
  { name: "Sunshine Canyon Landfill", address: "14747 Little Tujunga Cyn Rd", city: "Sylmar", state: "CA", zip: "91342", type: "landfill" as const },
  { name: "Kirby Canyon C&D Landfill", address: "1000 Bailey Ave", city: "Morgan Hill", state: "CA", zip: "95037", type: "construction_debris" as const },
  { name: "Ox Mountain Landfill", address: "4005 Cabrillo Hwy N", city: "Half Moon Bay", state: "CA", zip: "94019", type: "landfill" as const },

  // Colorado
  { name: "Arapahoe County Landfill", address: "1901 W Quincy Ave", city: "Englewood", state: "CO", zip: "80110", type: "landfill" as const, phone: "(303) 795-4520" },
  { name: "Denver Arapahoe Disposal Site", address: "4600 S Chambers Rd", city: "Aurora", state: "CO", zip: "80015", type: "landfill" as const },
  { name: "Larimer County Landfill", address: "5887 S County Rd 9E", city: "Fort Collins", state: "CO", zip: "80528", type: "landfill" as const, phone: "(970) 498-5770" },
  { name: "Colorado Springs C&D Landfill", address: "3975 Astrozon Blvd", city: "Colorado Springs", state: "CO", zip: "80910", type: "construction_debris" as const },
  { name: "Denver Waste Transfer", address: "1500 W Alameda Ave", city: "Denver", state: "CO", zip: "80223", type: "transfer_station" as const },

  // Connecticut
  { name: "Connecticut Materials Innovation Recycling Authority", address: "100 Constitution Plaza", city: "Hartford", state: "CT", zip: "06103", type: "recycling_center" as const, phone: "(860) 757-7700" },
  { name: "Wallingford Transfer Station", address: "70 Elm St", city: "Wallingford", state: "CT", zip: "06492", type: "transfer_station" as const },
  { name: "New Milford Landfill", address: "36 Landfill Rd", city: "New Milford", state: "CT", zip: "06776", type: "landfill" as const },
  { name: "American Fiber Industries", address: "150 Captains Walk", city: "New London", state: "CT", zip: "06320", type: "recycling_center" as const },

  // Delaware
  { name: "Cherry Island Landfill", address: "900 E Lea Blvd", city: "Wilmington", state: "DE", zip: "19802", type: "landfill" as const, phone: "(302) 429-4714" },
  { name: "Delaware Solid Waste Authority", address: "1128 S Bradford St", city: "Dover", state: "DE", zip: "19904", type: "transfer_station" as const, phone: "(302) 739-5361" },
  { name: "Georgetown Transfer Station", address: "21587 Redden Rd", city: "Georgetown", state: "DE", zip: "19947", type: "transfer_station" as const },

  // Florida
  { name: "Orange County Landfill", address: "5901 Young Pine Rd", city: "Orlando", state: "FL", zip: "32829", type: "landfill" as const, phone: "(407) 836-6610" },
  { name: "Miami-Dade Resources Recovery", address: "3050 NW 48th St", city: "Miami", state: "FL", zip: "33142", type: "transfer_station" as const, phone: "(305) 633-8500" },
  { name: "Hillsborough C&D Landfill", address: "4020 N 50th St", city: "Tampa", state: "FL", zip: "33610", type: "construction_debris" as const },
  { name: "Broward County North Regional Landfill", address: "2780 W Prospect Rd", city: "Pompano Beach", state: "FL", zip: "33069", type: "landfill" as const, phone: "(954) 970-3100" },
  { name: "Jacksonville Waste Transfer", address: "2055 W 45th St", city: "Jacksonville", state: "FL", zip: "32209", type: "transfer_station" as const },

  // Georgia
  { name: "Conestoga Landfill", address: "1400 Riverside Pkwy", city: "LaGrange", state: "GA", zip: "30240", type: "landfill" as const },
  { name: "Fulton County Landfill", address: "3030 Buffington Rd", city: "Atlanta", state: "GA", zip: "30349", type: "landfill" as const, phone: "(404) 730-5600" },
  { name: "Athens-Clarke County Landfill", address: "3035 Old Commerce Rd", city: "Athens", state: "GA", zip: "30607", type: "landfill" as const, phone: "(706) 613-3512" },
  { name: "Savannah C&D Landfill", address: "7001 Chevis Rd", city: "Savannah", state: "GA", zip: "31419", type: "construction_debris" as const },
  { name: "Cherokee County Transfer Station", address: "1130 Marietta Hwy", city: "Canton", state: "GA", zip: "30114", type: "transfer_station" as const },

  // Hawaii
  { name: "Waimanalo Gulch Sanitary Landfill", address: "87-2020 Farrington Hwy", city: "Kapolei", state: "HI", zip: "96707", type: "landfill" as const, phone: "(808) 768-3468" },
  { name: "Hilo Transfer Station", address: "232 Puna St", city: "Hilo", state: "HI", zip: "96720", type: "transfer_station" as const, phone: "(808) 961-8270" },
  { name: "Kona Transfer Station", address: "74-5454 Kealakehe Pkwy", city: "Kailua-Kona", state: "HI", zip: "96740", type: "transfer_station" as const },

  // Idaho
  { name: "Ada County Landfill", address: "10300 W Amity Rd", city: "Boise", state: "ID", zip: "83709", type: "landfill" as const, phone: "(208) 577-4730" },
  { name: "Canyon County Landfill", address: "4949 Recycling Ln", city: "Caldwell", state: "ID", zip: "83607", type: "landfill" as const },
  { name: "Pocatello Solid Waste Facility", address: "1985 Flandro Dr", city: "Pocatello", state: "ID", zip: "83204", type: "landfill" as const },
  { name: "Coeur d'Alene Transfer Station", address: "2900 N Government Way", city: "Coeur d'Alene", state: "ID", zip: "83815", type: "transfer_station" as const },

  // Illinois
  { name: "Chicago Southwest Composting", address: "11600 S Stony Island Ave", city: "Chicago", state: "IL", zip: "60617", type: "compost" as const, phone: "(312) 747-5570" },
  { name: "Waste Management Orchard Hills Landfill", address: "11714 Kishwaukee Church Rd", city: "Kirkland", state: "IL", zip: "60146", type: "landfill" as const },
  { name: "Laidlaw C&D Landfill Rockford", address: "3815 N Main St", city: "Rockford", state: "IL", zip: "61103", type: "construction_debris" as const },
  { name: "Peoria C&D Landfill", address: "4600 N Allen Rd", city: "Peoria", state: "IL", zip: "61614", type: "construction_debris" as const },
  { name: "Springfield Transfer Station", address: "700 W Lake Shore Dr", city: "Springfield", state: "IL", zip: "62712", type: "transfer_station" as const },

  // Indiana
  { name: "Indianapolis Marion County Landfill", address: "2700 S Tibbs Ave", city: "Indianapolis", state: "IN", zip: "46241", type: "landfill" as const, phone: "(317) 327-2000" },
  { name: "Fort Wayne C&D Landfill", address: "625 W Washington Blvd", city: "Fort Wayne", state: "IN", zip: "46802", type: "construction_debris" as const },
  { name: "Evansville Solid Waste", address: "3400 N 1st Ave", city: "Evansville", state: "IN", zip: "47710", type: "transfer_station" as const },
  { name: "Vigo County Landfill", address: "3501 N 4th St", city: "Terre Haute", state: "IN", zip: "47807", type: "landfill" as const },

  // Iowa
  { name: "Metro Park East Landfill", address: "3000 E 26th St", city: "Des Moines", state: "IA", zip: "50317", type: "landfill" as const, phone: "(515) 283-8183" },
  { name: "Iowa City Landfill & Recycling Center", address: "3900 Hebl Ave SW", city: "Iowa City", state: "IA", zip: "52240", type: "landfill" as const, phone: "(319) 356-5185" },
  { name: "Cedar Rapids Landfill", address: "6900 Otis Rd SE", city: "Cedar Rapids", state: "IA", zip: "52403", type: "landfill" as const },
  { name: "Sioux City Landfill", address: "5600 Correctionville Rd", city: "Sioux City", state: "IA", zip: "51103", type: "landfill" as const },

  // Kansas
  { name: "Sedgwick County Landfill", address: "4500 W 53rd St N", city: "Wichita", state: "KS", zip: "67205", type: "landfill" as const, phone: "(316) 660-7690" },
  { name: "Johnson County Transfer Station", address: "9900 W 159th St", city: "Olathe", state: "KS", zip: "66062", type: "transfer_station" as const },
  { name: "Shawnee County Landfill", address: "3001 SW Burlingame Rd", city: "Topeka", state: "KS", zip: "66611", type: "landfill" as const },
  { name: "Douglas County C&D Landfill", address: "3701 E 25th St", city: "Lawrence", state: "KS", zip: "66046", type: "construction_debris" as const },

  // Kentucky
  { name: "Louisville Metro Solid Waste", address: "6501 Grade Ln", city: "Louisville", state: "KY", zip: "40213", type: "landfill" as const, phone: "(502) 574-5800" },
  { name: "Lexington-Fayette County Landfill", address: "1306 Old Frankfort Pike", city: "Lexington", state: "KY", zip: "40510", type: "landfill" as const },
  { name: "Bowling Green Warren County Landfill", address: "3360 Russellville Rd", city: "Bowling Green", state: "KY", zip: "42101", type: "landfill" as const },
  { name: "Northern Kentucky C&D Landfill", address: "13000 KY-536", city: "Covington", state: "KY", zip: "41011", type: "construction_debris" as const },

  // Louisiana
  { name: "Jefferson Parish Landfill", address: "4801 River Rd", city: "Avondale", state: "LA", zip: "70094", type: "landfill" as const, phone: "(504) 736-6950" },
  { name: "Baton Rouge Waste Management", address: "1700 N Lobdell Blvd", city: "Baton Rouge", state: "LA", zip: "70806", type: "transfer_station" as const },
  { name: "New Orleans East Landfill", address: "7100 Read Blvd", city: "New Orleans", state: "LA", zip: "70127", type: "landfill" as const },
  { name: "Shreveport Stonewall Landfill", address: "100 Stonewall Blvd", city: "Stonewall", state: "LA", zip: "71078", type: "landfill" as const },

  // Maine
  { name: "Juniper Ridge Landfill", address: "300 Sawmill Rd", city: "Old Town", state: "ME", zip: "04468", type: "landfill" as const, phone: "(207) 948-3610" },
  { name: "Portland Transfer Station", address: "249 Canco Rd", city: "Portland", state: "ME", zip: "04103", type: "transfer_station" as const, phone: "(207) 874-8300" },
  { name: "Bangor C&D Landfill", address: "1023 Mineral Springs Rd", city: "Bangor", state: "ME", zip: "04401", type: "construction_debris" as const },

  // Maryland
  { name: "Western Acceptance Facility", address: "11301 Crain Hwy", city: "Cheltenham", state: "MD", zip: "20623", type: "transfer_station" as const, phone: "(301) 877-4094" },
  { name: "Baltimore BRESCO Landfill", address: "1901 Annapolis Rd", city: "Baltimore", state: "MD", zip: "21230", type: "landfill" as const },
  { name: "Frederick County C&D Recycling", address: "9031 Reichs Ford Rd", city: "Frederick", state: "MD", zip: "21704", type: "construction_debris" as const },
  { name: "Montgomery County Transfer Station", address: "16101 Frederick Rd", city: "Derwood", state: "MD", zip: "20855", type: "transfer_station" as const },

  // Massachusetts
  { name: "Covanta Southeast MA", address: "1 Main St", city: "Wareham", state: "MA", zip: "02571", type: "transfer_station" as const },
  { name: "Boston Gregg Hall Transfer Station", address: "290 Holton St", city: "Boston", state: "MA", zip: "02134", type: "transfer_station" as const, phone: "(617) 635-7500" },
  { name: "Southbridge Landfill", address: "100 Landfill Rd", city: "Southbridge", state: "MA", zip: "01550", type: "landfill" as const },
  { name: "Springfield C&D Landfill", address: "155 Liberty St", city: "Springfield", state: "MA", zip: "01104", type: "construction_debris" as const },

  // Michigan
  { name: "Wayne County Landfill", address: "48840 Michigan Ave", city: "Canton", state: "MI", zip: "48188", type: "landfill" as const },
  { name: "Granger Waste Services Lansing", address: "2600 S High St", city: "Lansing", state: "MI", zip: "48910", type: "transfer_station" as const, phone: "(517) 372-0100" },
  { name: "Kettle Cliffs Landfill", address: "5890 Elm Valley Rd", city: "Muskegon", state: "MI", zip: "49441", type: "landfill" as const },
  { name: "Oakland County North Landfill", address: "5851 N Adams Rd", city: "Pontiac", state: "MI", zip: "48340", type: "landfill" as const },
  { name: "Grand Rapids C&D", address: "1355 Wealthy St SE", city: "Grand Rapids", state: "MI", zip: "49506", type: "construction_debris" as const },

  // Minnesota
  { name: "Burnsville Sanitary Landfill", address: "12800 Trunk Hwy 13", city: "Burnsville", state: "MN", zip: "55337", type: "landfill" as const, phone: "(952) 895-4515" },
  { name: "Minneapolis Transfer Station", address: "3001 2nd St S", city: "Minneapolis", state: "MN", zip: "55408", type: "transfer_station" as const },
  { name: "Ramsey County C&D Landfill", address: "2785 White Bear Ave", city: "Maplewood", state: "MN", zip: "55109", type: "construction_debris" as const },
  { name: "Pine Bend Landfill", address: "3550 Pine Bend Trail", city: "Inver Grove Heights", state: "MN", zip: "55076", type: "landfill" as const },

  // Mississippi
  { name: "Jackson Landfill", address: "1100 Maddox Rd", city: "Jackson", state: "MS", zip: "39213", type: "landfill" as const, phone: "(601) 960-1578" },
  { name: "Harrison County C&D Landfill", address: "15100 County Farm Rd", city: "Gulfport", state: "MS", zip: "39503", type: "construction_debris" as const },
  { name: "Madison County Transfer Station", address: "240 Commerce Park Dr", city: "Madison", state: "MS", zip: "39110", type: "transfer_station" as const },

  // Missouri
  { name: "Hamm Landfill St. Louis", address: "15800 Halls Ferry Rd", city: "Florissant", state: "MO", zip: "63034", type: "landfill" as const },
  { name: "Kansas City Blue Ridge Landfill", address: "10001 Blue Ridge Blvd", city: "Kansas City", state: "MO", zip: "64134", type: "landfill" as const, phone: "(816) 513-3000" },
  { name: "Springfield C&D Landfill", address: "4955 W Farm Rd", city: "Springfield", state: "MO", zip: "65802", type: "construction_debris" as const },
  { name: "Columbia Transfer Station", address: "1313 Bellview Rd", city: "Columbia", state: "MO", zip: "65203", type: "transfer_station" as const },

  // Montana
  { name: "Missoula Landfill", address: "2750 Mullan Rd", city: "Missoula", state: "MT", zip: "59808", type: "landfill" as const, phone: "(406) 258-4750" },
  { name: "Billings Heights Landfill", address: "4200 Gabel Rd", city: "Billings", state: "MT", zip: "59105", type: "landfill" as const },
  { name: "Great Falls Waste Disposal", address: "101 14th St SW", city: "Great Falls", state: "MT", zip: "59404", type: "landfill" as const },
  { name: "Helena Transfer Station", address: "3300 N Montana Ave", city: "Helena", state: "MT", zip: "59601", type: "transfer_station" as const },

  // Nebraska
  { name: "Lincoln Sanitary Landfill", address: "4600 N 56th St", city: "Lincoln", state: "NE", zip: "68524", type: "landfill" as const, phone: "(402) 441-8250" },
  { name: "Omaha Metro Waste Authority", address: "1045 S 3rd St", city: "Omaha", state: "NE", zip: "68108", type: "transfer_station" as const, phone: "(402) 444-5238" },
  { name: "Grand Island Landfill", address: "400 W Wildwood Dr", city: "Grand Island", state: "NE", zip: "68803", type: "landfill" as const },

  // Nevada
  { name: "Las Vegas Apex Landfill", address: "4250 Losee Rd", city: "North Las Vegas", state: "NV", zip: "89030", type: "landfill" as const, phone: "(702) 455-0562" },
  { name: "Reno Transfer Station", address: "555 Western Rd", city: "Reno", state: "NV", zip: "89506", type: "transfer_station" as const, phone: "(775) 328-2169" },
  { name: "Henderson C&D Landfill", address: "1700 Boulder Hwy", city: "Henderson", state: "NV", zip: "89002", type: "construction_debris" as const },
  { name: "Sparks Regional Waste Facility", address: "2245 Victorian Ave", city: "Sparks", state: "NV", zip: "89431", type: "landfill" as const },

  // New Hampshire
  { name: "North Country Environmental Services", address: "400 N Stark Hwy", city: "Bethlehem", state: "NH", zip: "03574", type: "landfill" as const },
  { name: "Manchester Transfer Station", address: "640 Elm St", city: "Manchester", state: "NH", zip: "03101", type: "transfer_station" as const, phone: "(603) 624-6444" },
  { name: "Concord Waste Facility", address: "150 Recycling Center Rd", city: "Concord", state: "NH", zip: "03303", type: "recycling_center" as const },

  // New Jersey
  { name: "Hackettstown Landfill", address: "2800 US-46", city: "Hackettstown", state: "NJ", zip: "07840", type: "landfill" as const },
  { name: "Newark Transfer Station", address: "40 Central Ave", city: "Newark", state: "NJ", zip: "07103", type: "transfer_station" as const, phone: "(973) 733-5000" },
  { name: "Bergen County Utilities Authority", address: "1 DeKorte Park Plaza", city: "Lyndhurst", state: "NJ", zip: "07071", type: "transfer_station" as const },
  { name: "Middlesex County Landfill", address: "1600 Summerhall Way", city: "South Brunswick", state: "NJ", zip: "08852", type: "landfill" as const },

  // New Mexico
  { name: "Albuquerque Cerro Colorado Landfill", address: "7000 Unser Blvd NW", city: "Albuquerque", state: "NM", zip: "87121", type: "landfill" as const, phone: "(505) 761-8100" },
  { name: "Santa Fe Cuyamungue Landfill", address: "100 Cuyamungue Rd", city: "Pojoaque", state: "NM", zip: "87506", type: "landfill" as const },
  { name: "Las Cruces Landfill", address: "1201 S Valley Dr", city: "Las Cruces", state: "NM", zip: "88005", type: "landfill" as const },

  // New York
  { name: "Fresh Kills Landfill", address: "Arthur Kill Rd", city: "Staten Island", state: "NY", zip: "10303", type: "landfill" as const },
  { name: "Seneca Meadows Landfill", address: "3491 Townline Rd", city: "Waterloo", state: "NY", zip: "13165", type: "landfill" as const, phone: "(315) 539-5686" },
  { name: "NYC Department of Sanitation – Brooklyn", address: "1625 36th St", city: "Brooklyn", state: "NY", zip: "11218", type: "transfer_station" as const, phone: "(212) 334-8505" },
  { name: "Hempstead C&D Landfill", address: "1600 Merrick Ave", city: "Merrick", state: "NY", zip: "11566", type: "construction_debris" as const },
  { name: "Albany Rapp Road Landfill", address: "200 Rapp Rd", city: "Albany", state: "NY", zip: "12203", type: "landfill" as const },

  // North Carolina
  { name: "Uwharrie Environmental Corp Landfill", address: "3403 Landfill Rd", city: "Troy", state: "NC", zip: "27371", type: "landfill" as const },
  { name: "Charlotte Hickory Grove Rd Landfill", address: "3720 Hickory Grove Rd", city: "Charlotte", state: "NC", zip: "28269", type: "landfill" as const, phone: "(704) 432-2900" },
  { name: "Wake County Landfill", address: "9800 Deponie Dr", city: "Raleigh", state: "NC", zip: "27603", type: "landfill" as const, phone: "(919) 856-6180" },
  { name: "Durham C&D Landfill", address: "1900 E Club Blvd", city: "Durham", state: "NC", zip: "27704", type: "construction_debris" as const },

  // North Dakota
  { name: "Fargo Waste Disposal", address: "3255 Veterans Blvd N", city: "Fargo", state: "ND", zip: "58102", type: "landfill" as const, phone: "(701) 241-8160" },
  { name: "Bismarck City Landfill", address: "1700 E Burnt Boat Dr", city: "Bismarck", state: "ND", zip: "58503", type: "landfill" as const },
  { name: "Grand Forks County Landfill", address: "900 N 42nd St", city: "Grand Forks", state: "ND", zip: "58201", type: "landfill" as const },

  // Ohio
  { name: "Mahoning County Landfill", address: "7145 Shirley Rd", city: "Berlin Center", state: "OH", zip: "44401", type: "landfill" as const },
  { name: "Columbus Solid Waste", address: "3900 Jackson Pike", city: "Columbus", state: "OH", zip: "43228", type: "landfill" as const, phone: "(614) 645-7900" },
  { name: "Cleveland Lakefront Landfill", address: "3800 Lake Rd", city: "Cleveland", state: "OH", zip: "44113", type: "landfill" as const },
  { name: "Hamilton County C&D Landfill", address: "10200 Pippin Rd", city: "Cincinnati", state: "OH", zip: "45231", type: "construction_debris" as const },
  { name: "Akron Transfer Station", address: "1100 Tallmadge Rd", city: "Akron", state: "OH", zip: "44310", type: "transfer_station" as const },

  // Oklahoma
  { name: "Oklahoma City Southeast Landfill", address: "6900 S Air Depot Blvd", city: "Oklahoma City", state: "OK", zip: "73135", type: "landfill" as const, phone: "(405) 297-2838" },
  { name: "Tulsa Transfer Station", address: "4400 N 97th E Ave", city: "Tulsa", state: "OK", zip: "74116", type: "transfer_station" as const },
  { name: "Cleveland County Landfill", address: "2301 36th Ave NW", city: "Norman", state: "OK", zip: "73072", type: "landfill" as const },

  // Oregon
  { name: "Columbia Ridge Landfill", address: "34849 Christensen Rd", city: "Arlington", state: "OR", zip: "97812", type: "landfill" as const, phone: "(541) 454-2200" },
  { name: "Gresham Transfer Station", address: "3131 NE Cleveland Ave", city: "Gresham", state: "OR", zip: "97030", type: "transfer_station" as const },
  { name: "Eugene C&D Landfill", address: "3500 W 1st Ave", city: "Eugene", state: "OR", zip: "97402", type: "construction_debris" as const },
  { name: "Portland Metro South Transfer Station", address: "2001 Washington St", city: "Oregon City", state: "OR", zip: "97045", type: "transfer_station" as const },

  // Pennsylvania
  { name: "Keystone Landfill", address: "600 Keystone Blvd", city: "Dunmore", state: "PA", zip: "18512", type: "landfill" as const, phone: "(570) 343-9961" },
  { name: "Philadelphia C&D Transfer", address: "3000 Richmond St", city: "Philadelphia", state: "PA", zip: "19134", type: "construction_debris" as const, phone: "(215) 686-5560" },
  { name: "Chartiers Landfill", address: "360 S Lynn Ave", city: "Houston", state: "PA", zip: "15342", type: "landfill" as const },
  { name: "Dauphin County Landfill", address: "2002 Greengate Ave", city: "Harrisburg", state: "PA", zip: "17111", type: "landfill" as const },
  { name: "Pittsburgh South Transfer Station", address: "860 Saw Mill Run Blvd", city: "Pittsburgh", state: "PA", zip: "15226", type: "transfer_station" as const },

  // Rhode Island
  { name: "Central Landfill Johnston", address: "65 Shun Pike", city: "Johnston", state: "RI", zip: "02919", type: "landfill" as const, phone: "(401) 942-1430" },
  { name: "Providence Transfer Station", address: "1000 N Main St", city: "Providence", state: "RI", zip: "02904", type: "transfer_station" as const },

  // South Carolina
  { name: "Richland County Landfill", address: "820 Landfill Ln", city: "Columbia", state: "SC", zip: "29203", type: "landfill" as const, phone: "(803) 576-2400" },
  { name: "Charleston County Bees Ferry Landfill", address: "1781 Bees Ferry Rd", city: "Charleston", state: "SC", zip: "29414", type: "landfill" as const, phone: "(843) 720-7111" },
  { name: "Greenville County C&D Landfill", address: "301 University Ridge", city: "Greenville", state: "SC", zip: "29601", type: "construction_debris" as const },

  // South Dakota
  { name: "Sioux Falls Regional Sanitary Landfill", address: "2101 N Sycamore Ave", city: "Sioux Falls", state: "SD", zip: "57104", type: "landfill" as const, phone: "(605) 367-8185" },
  { name: "Rapid City Transfer Station", address: "6900 E St Patrick St", city: "Rapid City", state: "SD", zip: "57701", type: "transfer_station" as const },
  { name: "Pierre Landfill", address: "200 Landfill Rd", city: "Pierre", state: "SD", zip: "57501", type: "landfill" as const },

  // Tennessee
  { name: "Nashville Southeast Landfill", address: "1701 Bell Rd", city: "Nashville", state: "TN", zip: "37217", type: "landfill" as const, phone: "(615) 862-8750" },
  { name: "Memphis Shelby County C&D Landfill", address: "4145 Appling Way", city: "Memphis", state: "TN", zip: "38133", type: "construction_debris" as const },
  { name: "Knox County Waste Management", address: "3101 Maryville Pike", city: "Knoxville", state: "TN", zip: "37920", type: "landfill" as const, phone: "(865) 215-4311" },
  { name: "Hamilton County Landfill", address: "1630 Pineville Rd", city: "Chattanooga", state: "TN", zip: "37415", type: "landfill" as const },

  // Texas
  { name: "Texas Lehigh Cement Landfill", address: "5400 S Stemmons Fwy", city: "Lewisville", state: "TX", zip: "75067", type: "construction_debris" as const },
  { name: "City of Houston Northwest Transfer Station", address: "10500 Westpark Dr", city: "Houston", state: "TX", zip: "77042", type: "transfer_station" as const, phone: "(713) 837-9100" },
  { name: "Blue Ridge Landfill Houston", address: "7400 Windfern Rd", city: "Houston", state: "TX", zip: "77040", type: "landfill" as const },
  { name: "McCommas Bluff Landfill Dallas", address: "5100 Youngblood Rd", city: "Dallas", state: "TX", zip: "75227", type: "landfill" as const, phone: "(214) 670-4475" },
  { name: "San Antonio Covel Gardens Landfill", address: "12500 Marbach Rd", city: "San Antonio", state: "TX", zip: "78245", type: "landfill" as const },
  { name: "Austin Waste Management", address: "3020 Decker Ln", city: "Austin", state: "TX", zip: "78724", type: "landfill" as const, phone: "(512) 978-4000" },
  { name: "Tarrant County C&D Landfill", address: "301 SE Loop 820", city: "Fort Worth", state: "TX", zip: "76140", type: "construction_debris" as const },

  // Utah
  { name: "Salt Lake Valley Landfill", address: "6030 W California Ave", city: "West Valley City", state: "UT", zip: "84120", type: "landfill" as const, phone: "(801) 974-6919" },
  { name: "Davis County Landfill", address: "4500 W 650 N", city: "West Point", state: "UT", zip: "84015", type: "landfill" as const },
  { name: "Weber County Landfill", address: "2425 W 1900 N", city: "Ogden", state: "UT", zip: "84404", type: "landfill" as const },
  { name: "Provo City Landfill", address: "1750 W Center St", city: "Provo", state: "UT", zip: "84601", type: "landfill" as const },

  // Vermont
  { name: "Coventry Landfill", address: "191 Morrill Rd", city: "Coventry", state: "VT", zip: "05825", type: "landfill" as const, phone: "(802) 754-2900" },
  { name: "Burlington Transfer Station", address: "131 Airport Pkwy", city: "South Burlington", state: "VT", zip: "05403", type: "transfer_station" as const, phone: "(802) 658-6096" },
  { name: "Montpelier Transfer Station", address: "200 Barre-Montpelier Rd", city: "Montpelier", state: "VT", zip: "05602", type: "transfer_station" as const },

  // Virginia
  { name: "Fairfax County Lorton Landfill", address: "9850 Furnace Rd", city: "Lorton", state: "VA", zip: "22079", type: "landfill" as const, phone: "(703) 690-4227" },
  { name: "Richmond City C&D Landfill", address: "1700 Robin Hood Rd", city: "Richmond", state: "VA", zip: "23220", type: "construction_debris" as const },
  { name: "Virginia Beach Transfer Station", address: "1989 Potters Rd", city: "Virginia Beach", state: "VA", zip: "23454", type: "transfer_station" as const },
  { name: "Arlington County Landfill", address: "4300 75th St N", city: "Arlington", state: "VA", zip: "22207", type: "landfill" as const },
  { name: "Norfolk Transfer Station", address: "4700 Ely Crescent", city: "Norfolk", state: "VA", zip: "23523", type: "transfer_station" as const },

  // Washington
  { name: "Columbia Ridge Landfill WA", address: "5155 Industrial Way", city: "Boardman", state: "WA", zip: "97818", type: "landfill" as const },
  { name: "Cedar Hills Regional Landfill", address: "16645 SE 240th St", city: "Maple Valley", state: "WA", zip: "98038", type: "landfill" as const, phone: "(206) 477-4466" },
  { name: "Seattle South Transfer Station", address: "1870 53rd Ave S", city: "Seattle", state: "WA", zip: "98108", type: "transfer_station" as const, phone: "(206) 296-4462" },
  { name: "Spokane Waste to Energy", address: "2900 S Geiger Blvd", city: "Spokane", state: "WA", zip: "99224", type: "transfer_station" as const },
  { name: "Tacoma Tideflats Landfill", address: "2949 Marine View Dr", city: "Tacoma", state: "WA", zip: "98422", type: "landfill" as const },

  // West Virginia
  { name: "Tri-Cities Landfill", address: "1000 Landfill Rd", city: "Huntington", state: "WV", zip: "25701", type: "landfill" as const },
  { name: "Charleston Landfill", address: "2100 MacCorkle Ave SW", city: "Charleston", state: "WV", zip: "25303", type: "landfill" as const, phone: "(304) 348-8048" },
  { name: "Morgantown Hazardous Waste", address: "300 Stewart St", city: "Morgantown", state: "WV", zip: "26505", type: "hazardous_waste" as const },

  // Wisconsin
  { name: "Madison Landfill", address: "7102 US-12", city: "Madison", state: "WI", zip: "53593", type: "landfill" as const, phone: "(608) 267-8700" },
  { name: "Milwaukee C&D Landfill", address: "4500 W Burnham St", city: "Milwaukee", state: "WI", zip: "53219", type: "construction_debris" as const },
  { name: "Pheasant Run Landfill Green Bay", address: "2040 Universal St", city: "Green Bay", state: "WI", zip: "54304", type: "landfill" as const },
  { name: "Rock County Landfill", address: "3703 N Oakhill Ave", city: "Janesville", state: "WI", zip: "53548", type: "landfill" as const },

  // Wyoming
  { name: "Cheyenne Landfill", address: "1401 E College Dr", city: "Cheyenne", state: "WY", zip: "82007", type: "landfill" as const, phone: "(307) 637-6218" },
  { name: "Casper Solid Waste", address: "1500 S Walsh Dr", city: "Casper", state: "WY", zip: "82601", type: "landfill" as const },
  { name: "Laramie Landfill", address: "3710 Soldier Springs Rd", city: "Laramie", state: "WY", zip: "82070", type: "landfill" as const },
  { name: "Rock Springs Landfill", address: "100 Landfill Rd", city: "Rock Springs", state: "WY", zip: "82901", type: "landfill" as const },
];

export async function seedDumpSites(): Promise<void> {
  console.log(`Seeding ${sites.length} dump sites...`);

  await db.execute(sql`TRUNCATE TABLE dump_sites RESTART IDENTITY CASCADE`);

  const batchSize = 50;
  for (let i = 0; i < sites.length; i += batchSize) {
    const batch = sites.slice(i, i + batchSize);
    await db.insert(dumpSitesTable).values(batch);
    console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} sites)`);
  }

  console.log("Done seeding dump sites.");
}

async function seed() {
  await seedDumpSites();
  process.exit(0);
}

const isCliEntry = process.argv[1]?.includes("dump-sites");
if (isCliEntry) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
