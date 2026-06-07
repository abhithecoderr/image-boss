/**
 * Image Boss - Solutions Configuration
 * Defines target industry use cases, description text, and associated primary tools.
 */

export const SOLUTIONS = {
  'ecommerce': {
    id: 'ecommerce',
    name: 'E-Commerce Photography',
    icon: 'ecommerce',
    description: 'Create high-converting product photos for Amazon, Shopify, and eBay.',
    primaryService: 'background-removal',
    tagline: 'Supercharge your store sales with studio-quality product catalog images.',
    badge: 'Retail & E-Commerce',
    content: {
      overview: 'In the world of online shopping, your product images are your sales reps. Poor lighting, cluttered backgrounds, and blurry details can drive customers away in seconds. Image Boss gives e-commerce merchants, store owners, and marketplace sellers the professional edge to design premium product photos directly in the browser.',
      problem: 'Traditional product photography is expensive, slow, and requires technical editing skills. Removing backgrounds, resizing, and optimizing images for web speeds takes hours of manual work.',
      solution: 'Our local AI tools let you remove distracting backgrounds in one click, upscale image resolutions by 4x for crystal clear details, and compress the file size without losing quality, ensuring your site load times remain lightning-fast.',
      features: [
        { title: 'One-Click Background Removal', desc: 'Isolate products with clean, transparent, or solid white backgrounds in seconds.' },
        { title: '4x Detail Upscaling', desc: 'Sharpen low-res vendor photos or mobile snaps into crisp, high-resolution catalog images.' },
        { title: 'Smart Compression', desc: 'Optimize WebP and PNG files to reduce load time and improve your store\'s SEO rankings.' }
      ],
      faqs: [
        { q: 'Can I batch process my product photos?', a: 'Yes! Image Boss supports batch mode, allowing you to upload and remove backgrounds for multiple product photos at once.' },
        { q: 'Is it safe to upload my proprietary product designs?', a: 'Completely. All AI models run locally in your browser. Your images never leave your machine and are not uploaded to any external servers.' }
      ]
    }
  },
  'real-estate': {
    id: 'real-estate',
    name: 'Real Estate & Properties',
    icon: 'real-estate',
    description: 'Enhance interior and exterior photos for property listings.',
    primaryService: 'magic-erase',
    tagline: 'Clean up room views and enhance lighting for fast-selling property listings.',
    badge: 'Property & Real Estate',
    content: {
      overview: 'First impressions are everything in property listings. Uncluttered, high-resolution photos make homes sell faster. Image Boss provides real estate agents, property managers, and photographers with tools to polish interior shots and maintain listing privacy.',
      problem: 'Unwanted clutter like power cords, personal items, or random debris can ruin a perfect room photo. Additionally, capturing high-quality details in varying lighting conditions is difficult without expensive cameras.',
      solution: 'Use our AI Magic Erase to wipe away clutter seamlessly, Upscale to reveal fine textures in flooring and countertops, and Face Blur to easily mask photos of residents or private details.',
      features: [
        { title: 'Magic Erase Clutter', desc: 'Brush away power lines, trash cans, personal items, or camera reflections in seconds.' },
        { title: 'Fine Detail Enhancer', desc: 'Upscale texture, wood grains, and tile details, making kitchens and baths pop.' },
        { title: 'Privacy Redaction', desc: 'Automatically blur bystander faces or private documents captured during photoshoots.' }
      ],
      faqs: [
        { q: 'How does Magic Erase work?', a: 'Simply brush over the unwanted object in the image, and our local AI inpainting model will reconstruct the background seamlessly.' },
        { q: 'Do I need a high-end graphics card?', a: 'While WebGPU acceleration helps, our models are optimized to run smoothly on standard laptops using WebAssembly.' }
      ]
    }
  },
  'social-media': {
    id: 'social-media',
    name: 'Social Media & Creators',
    icon: 'social-media',
    description: 'Design eye-catching thumbnails, banners, and posts.',
    primaryService: 'captioning',
    tagline: 'Engage your audience with stunning visuals and automated AI descriptors.',
    badge: 'Content Creators',
    content: {
      overview: 'Social media moves fast. To stand out on YouTube, Instagram, and LinkedIn, creators need high-impact visuals and optimized posts. Image Boss empowers creators to design stunning custom thumbnails, crop graphics, and automate metadata generation.',
      problem: 'Generating custom assets for multiple platforms requires switching between multiple heavy editing suites. Typing out descriptive alternative text (alt text) for accessibility is also tedious.',
      solution: 'Remove backgrounds to place yourself on custom canvas designs, upscale graphics for crisp displays, and generate automated captions and descriptions with our Vision-Language Model.',
      features: [
        { title: 'Background Cutouts', desc: 'Create perfect transparent cutouts of yourself or objects for YouTube thumbnails and collages.' },
        { title: 'AI-Generated Descriptions', desc: 'Get instant, descriptive captions for your images, perfect for alt text and social copy.' },
        { title: 'Format Conversion', desc: 'Convert heavy images to WebP/PNG formats optimized for Instagram, TikTok, and Twitter uploads.' }
      ],
      faqs: [
        { q: 'Does the caption service write hashtags?', a: 'Our Vision-Language Model generates detailed descriptions of the image contents, which you can easily use as bases for captions or alt text.' },
        { q: 'Can I customize the crop size?', a: 'Yes, our General Editor provides pre-set aspect ratios for standard social media crop sizes.' }
      ]
    }
  },
  'creative-studios': {
    id: 'creative-studios',
    name: 'Graphic Design & Studios',
    icon: 'creative-studios',
    description: 'Convert photos to sketch line art and extract custom vectors.',
    primaryService: 'line-art',
    tagline: 'Convert portraits to sketches and isolate complex layers for graphic design.',
    badge: 'Art & Creative Studios',
    content: {
      overview: 'Graphic designers, sketch artists, and branding agencies require flexible assets. Image Boss provides advanced creative options to turn photos into drawings and isolate design layers without heavy software.',
      problem: 'Manually sketching contours or selecting complex boundaries (like hair or fine lines) is one of the most time-consuming parts of digital art preparation.',
      solution: 'Instantly convert photos to detailed anime or contour line drawings, and use Segment Anything (SAM) to isolate specific components of an image with professional-grade masks.',
      features: [
        { title: 'Line Art Extraction', desc: 'Turn any image into a clean sketch or outline, ready for coloring or vector tracing.' },
        { title: 'Object Segmentation (SAM)', desc: 'Click to select and extract complex objects, figures, or patterns instantly.' },
        { title: 'High-Res Upscaling', desc: 'Prepare your artwork for print by upscaling sketches and illustrations up to 4x.' }
      ],
      faqs: [
        { q: 'Can I download the line art as SVG?', a: 'Currently, you can download it as a high-quality transparent PNG, which can be easily auto-traced in vector software like Illustrator.' },
        { q: 'What line styles are supported?', a: 'We offer Anime Drawing and Contour Drawing modes for distinct sketch outputs.' }
      ]
    }
  },
  'privacy-redaction': {
    id: 'privacy-redaction',
    name: 'Privacy & Redaction',
    icon: 'privacy-redaction',
    description: 'Secure sensitive images by blurring faces and erasing confidential data.',
    primaryService: 'blur',
    tagline: 'Keep customer data secure and redact sensitive info completely locally.',
    badge: 'Corporate Security',
    content: {
      overview: 'Privacy compliance (GDPR, CCPA) is vital when publishing photos of public spaces or sharing documents. Image Boss offers corporations, journalists, and legal teams a secure way to clean images before publishing.',
      problem: 'Sending sensitive documents or images to cloud APIs for editing exposes companies to data leak risks and regulatory compliance violations.',
      solution: 'Perform face redaction and object erasing fully offline inside the browser. Our AI runs strictly in-memory without uploading any data, guaranteeing complete confidentiality.',
      features: [
        { title: 'Automatic Face Blur', desc: 'Detect and blur all faces in an image instantly using deep learning YOLO models.' },
        { title: 'Sensitive Info Erasing', desc: 'Inpaint and erase credit card numbers, signatures, or licensing text using Magic Erase.' },
        { title: 'Local-Only Execution', desc: 'Ensure zero server transit for sensitive company files, satisfying legal security audits.' }
      ],
      faqs: [
        { q: 'Are my images saved on your servers?', a: 'Never. Image Boss is a local-first application. All computations occur in your browser\'s sandbox, so no image files are ever uploaded.' },
        { q: 'Can the blur be reversed?', a: 'Once the face blur is applied and exported as a new image, the pixel data is permanently overwritten, making it cryptographically impossible to reverse.' }
      ]
    }
  }
};

export const SOLUTIONS_ORDER = [
  'ecommerce',
  'real-estate',
  'social-media',
  'creative-studios',
  'privacy-redaction'
];
