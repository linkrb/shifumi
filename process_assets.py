from PIL import Image
import os

def process_image():
    input_path = '/home/rbremaud/Sites/shifumi/public/mascots_sheet.png'
    output_dir = '/home/rbremaud/Sites/shifumi/public/'
    
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        # Get dimensions
        width, height = img.size
        
        # Assume 3 equal parts horizontally
        part_width = width // 3
        
        mascots = ['rock_user.png', 'paper_user.png', 'scissors_user.png']
        
        for i, name in enumerate(mascots):
            # Crop
            left = i * part_width
            right = (i + 1) * part_width
            box = (left, 0, right, height)
            part = img.crop(box)
            
            # Simple background removal (remove white)
            # This is a basic heuristic, might need adjustment
            datas = part.getdata()
            new_data = []
            for item in datas:
                # If pixel is white (or very close), make it transparent
                if item[0] > 240 and item[1] > 240 and item[2] > 240:
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
            
            part.putdata(new_data)
            
            # Trim empty space (autocrop)
            bbox = part.getbbox()
            if bbox:
                part = part.crop(bbox)
            
            part.save(os.path.join(output_dir, name))
            print(f"Saved {name}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_image()
