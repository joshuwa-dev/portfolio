// import "dotenv/config";

export async function fetchCityWeather(city) {
  const apiKey = process.env.WEATHER_API_KEY;
  // if (!apiKey) {
  //   throw new Error("Missing WEATHER_API_KEY in environment variables");
  // }
  const response = await fetch(
    `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&aqi=no`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch weather ${response.status}`);
  }
  const data = await response.json();
  return data;
}

// fetchCityWeather()
//   .then((data) => {
//     console.log(
//       `✅ Weather in ${data.location.name}: ${data.current.temp_c}°C`
//     );
//   })
//   .catch((error) => {
//     console.error("❌ Error:", error.message);
//   });
