import { fetchCityWeather } from "../../../../src/lib/CityWeather";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // get query params from client
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");

    // call server function
    const data = await fetchCityWeather(city);

    //success response
    return NextResponse.json(data);
  } catch (error) {
    //error response
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
