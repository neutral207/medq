import { useState } from 'react';
import medqLogo from "../assets/images/medq-logo.png";

export default function PatientCheckIn() {
  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    reason: "",
    phone: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    // TODO: Implement into database
    e.preventDefault();
    console.log("Submitted:", formData);
    alert("Check-in data submitted");
  };

  return (
    <div className='min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white'>
      {/* Header */}
      <header className='pt-6 pb-0 flex flex-col items-center pointer-events-none'>
          <img
            src={medqLogo}
            alt="Med-Q Logo"
            className='block w-48 h-48 md:w-52 md:h-52 object-contain drop-shadow-lg mb-[-42px]'
          />
          <h1 className='text-2xl md:text-[42px] font-semibold tracking-wide text-white'>
            Med-Q
          </h1>
      </header>

      {/* Form */}
      <main className='px-6 flex items-center justify-center'>
        <form 
          onSubmit={handleSubmit} 
          className='w-[360px] space-y-4 text-[15px] font-medium'
        >
          <h2 className='font-semibold leading-snug mb-4 '>
            Welcome. Please fill out the following so we can better give the care you need.
          </h2>

          {/* Name */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Name:
              <input
                type='text'
                name='name'
                placeholder='Last M First'
                value={formData.name}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none'
                required
              />
            </label>
          </div>

          {/* Date of Birth */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Date of Birth:
              <input
                type='date'
                name='dob'
                value={formData.dob}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none'
                required
              />
            </label>
          </div>
          
          {/* Reason */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Reason for Visit:
              <input
                type='text'
                name='reason'
                placeholder='eg. sickness, body pain...'
                value={formData.reason}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none'
                required
              />
            </label>
          </div>

          {/* Phone */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Phone Number:
              <input
                type='tel'
                name='phone'
                placeholder='(123) 456-7890'
                value={formData.phone}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none'
                required
              />
            </label>
          </div>

          {/* Button */}
          <button 
            type='submit' 
            className="w-full mt-4 bg-medqPink hover:bg-pink-400 py-2 rounded-md font-semibold transition-colors"
          >
            Continue
          </button>
        </form>
      </main>
    </div>
  );
}