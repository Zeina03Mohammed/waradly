'use client';

import { Country, State } from 'country-state-city';

const countries = Country.getAllCountries();

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export function CountrySelect({ value, onChange, className = 'input', required }: CountrySelectProps) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Select a country</option>
      {countries.map((c) => (
        <option key={c.isoCode} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

interface RegionSelectProps {
  country: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

/** Some small countries have no states/provinces in the underlying dataset — falls back to a
 * free-text input for those rather than showing an empty, unusable dropdown. */
export function RegionSelect({ country, value, onChange, className = 'input', required }: RegionSelectProps) {
  const selectedCountry = countries.find((c) => c.name === country);
  const regions = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];

  if (selectedCountry && regions.length === 0) {
    return (
      <input
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Region"
        required={required}
      />
    );
  }

  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} disabled={!country} required={required}>
      <option value="">{country ? 'Select a region' : 'Select a country first'}</option>
      {regions.map((r) => (
        <option key={r.isoCode} value={r.name}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
