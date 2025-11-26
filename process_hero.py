from PIL import Image
import os

def process_hero():
    input_path = '/home/rbremaud/Sites/shifumi/public/hero_mascots.png'
    output_path = '/home/rbremaud/Sites/shifumi/public/hero_mascots_processed.png'
    
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        # Simple background removal (remove white)
        datas = img.getdata()
        new_data = []
        for item in datas:
            # If pixel is white (or very close), make it transparent
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        
        # Trim empty space
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        img.save(output_path)
        print(f"Saved {output_path}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_hero()
