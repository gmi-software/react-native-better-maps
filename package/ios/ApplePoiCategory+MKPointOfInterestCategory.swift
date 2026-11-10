import MapKit

extension ApplePoiCategory {
  static func from(_ category: MKPointOfInterestCategory?) -> (category: ApplePoiCategory, rawCategory: String?) {
    guard let category else {
      return (.unknown, nil)
    }

    if category == .airport { return (.airport, nil) }
    if category == .amusementPark { return (.amusementpark, nil) }
    if category == .aquarium { return (.aquarium, nil) }
    if category == .atm { return (.atm, nil) }
    if category == .bakery { return (.bakery, nil) }
    if category == .bank { return (.bank, nil) }
    if category == .beach { return (.beach, nil) }
    if category == .brewery { return (.brewery, nil) }
    if category == .cafe { return (.cafe, nil) }
    if category == .campground { return (.campground, nil) }
    if category == .carRental { return (.carrental, nil) }
    if category == .evCharger { return (.evcharger, nil) }
    if category == .fireStation { return (.firestation, nil) }
    if category == .fitnessCenter { return (.fitnesscenter, nil) }
    if category == .foodMarket { return (.foodmarket, nil) }
    if category == .gasStation { return (.gasstation, nil) }
    if category == .hospital { return (.hospital, nil) }
    if category == .hotel { return (.hotel, nil) }
    if category == .laundry { return (.laundry, nil) }
    if category == .library { return (.library, nil) }
    if category == .marina { return (.marina, nil) }
    if category == .movieTheater { return (.movietheater, nil) }
    if category == .museum { return (.museum, nil) }
    if category == .nationalPark { return (.nationalpark, nil) }
    if category == .nightlife { return (.nightlife, nil) }
    if category == .park { return (.park, nil) }
    if category == .parking { return (.parking, nil) }
    if category == .pharmacy { return (.pharmacy, nil) }
    if category == .police { return (.police, nil) }
    if category == .postOffice { return (.postoffice, nil) }
    if category == .publicTransport { return (.publictransport, nil) }
    if category == .restaurant { return (.restaurant, nil) }
    if category == .restroom { return (.restroom, nil) }
    if category == .school { return (.school, nil) }
    if category == .stadium { return (.stadium, nil) }
    if category == .store { return (.store, nil) }
    if category == .theater { return (.theater, nil) }
    if category == .university { return (.university, nil) }
    if category == .winery { return (.winery, nil) }
    if category == .zoo { return (.zoo, nil) }

    if #available(iOS 18.0, *) {
      if category == .animalService { return (.animalservice, nil) }
      if category == .automotiveRepair { return (.automotiverepair, nil) }
      if category == .baseball { return (.baseball, nil) }
      if category == .basketball { return (.basketball, nil) }
      if category == .beauty { return (.beauty, nil) }
      if category == .bowling { return (.bowling, nil) }
      if category == .castle { return (.castle, nil) }
      if category == .conventionCenter { return (.conventioncenter, nil) }
      if category == .distillery { return (.distillery, nil) }
      if category == .fairground { return (.fairground, nil) }
      if category == .fishing { return (.fishing, nil) }
      if category == .fortress { return (.fortress, nil) }
      if category == .golf { return (.golf, nil) }
      if category == .goKart { return (.gokart, nil) }
      if category == .hiking { return (.hiking, nil) }
      if category == .kayaking { return (.kayaking, nil) }
      if category == .landmark { return (.landmark, nil) }
      if category == .mailbox { return (.mailbox, nil) }
      if category == .miniGolf { return (.minigolf, nil) }
      if category == .musicVenue { return (.musicvenue, nil) }
      if category == .nationalMonument { return (.nationalmonument, nil) }
      if category == .planetarium { return (.planetarium, nil) }
      if category.rawValue == "MKPOICategoryPlayground" { return (.playground, nil) }
      if category.rawValue == "MKPOICategoryReligiousSite" { return (.religioussite, nil) }
      if category == .rockClimbing { return (.rockclimbing, nil) }
      if category == .rvPark { return (.rvpark, nil) }
      if category == .skatePark { return (.skatepark, nil) }
      if category == .skating { return (.skating, nil) }
      if category == .skiing { return (.skiing, nil) }
      if category == .soccer { return (.soccer, nil) }
      if category == .spa { return (.spa, nil) }
      if category == .surfing { return (.surfing, nil) }
      if category == .swimming { return (.swimming, nil) }
      if category == .tennis { return (.tennis, nil) }
      if category == .volleyball { return (.volleyball, nil) }
    }

    return (.unknown, category.rawValue)
  }

  /// The MapKit category for a POI filter, or nil when the running OS has none:
  /// the categories added in iOS 18 on iOS 16 and 17, and `unknown` everywhere.
  var mkPointOfInterestCategory: MKPointOfInterestCategory? {
    switch self {
    case .airport: return .airport
    case .amusementpark: return .amusementPark
    case .aquarium: return .aquarium
    case .atm: return .atm
    case .bakery: return .bakery
    case .bank: return .bank
    case .beach: return .beach
    case .brewery: return .brewery
    case .cafe: return .cafe
    case .campground: return .campground
    case .carrental: return .carRental
    case .evcharger: return .evCharger
    case .firestation: return .fireStation
    case .fitnesscenter: return .fitnessCenter
    case .foodmarket: return .foodMarket
    case .gasstation: return .gasStation
    case .hospital: return .hospital
    case .hotel: return .hotel
    case .laundry: return .laundry
    case .library: return .library
    case .marina: return .marina
    case .movietheater: return .movieTheater
    case .museum: return .museum
    case .nationalpark: return .nationalPark
    case .nightlife: return .nightlife
    case .park: return .park
    case .parking: return .parking
    case .pharmacy: return .pharmacy
    case .police: return .police
    case .postoffice: return .postOffice
    case .publictransport: return .publicTransport
    case .restaurant: return .restaurant
    case .restroom: return .restroom
    case .school: return .school
    case .stadium: return .stadium
    case .store: return .store
    case .theater: return .theater
    case .university: return .university
    case .winery: return .winery
    case .zoo: return .zoo
    case .unknown: return nil
    default: break
    }

    guard #available(iOS 18.0, *) else {
      return nil
    }
    switch self {
    case .animalservice: return .animalService
    case .automotiverepair: return .automotiveRepair
    case .baseball: return .baseball
    case .basketball: return .basketball
    case .beauty: return .beauty
    case .bowling: return .bowling
    case .castle: return .castle
    case .conventioncenter: return .conventionCenter
    case .distillery: return .distillery
    case .fairground: return .fairground
    case .fishing: return .fishing
    case .fortress: return .fortress
    case .golf: return .golf
    case .gokart: return .goKart
    case .hiking: return .hiking
    case .kayaking: return .kayaking
    case .landmark: return .landmark
    case .mailbox: return .mailbox
    case .minigolf: return .miniGolf
    case .musicvenue: return .musicVenue
    case .nationalmonument: return .nationalMonument
    case .planetarium: return .planetarium
    case .rockclimbing: return .rockClimbing
    case .rvpark: return .rvPark
    case .skatepark: return .skatePark
    case .skating: return .skating
    case .skiing: return .skiing
    case .soccer: return .soccer
    case .spa: return .spa
    case .surfing: return .surfing
    case .swimming: return .swimming
    case .tennis: return .tennis
    case .volleyball: return .volleyball
    case .playground: return MKPointOfInterestCategory(rawValue: "MKPOICategoryPlayground")
    case .religioussite: return MKPointOfInterestCategory(rawValue: "MKPOICategoryReligiousSite")
    default: return nil
    }
  }
}
