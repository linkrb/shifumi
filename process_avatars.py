from PIL import Image
import os

def split_avatars():
    # Paths to uploaded images (using the paths provided in metadata)
    image_paths = [
        "/home/rbremaud/.gemini/antigravity/brain/a6811d95-6569-4527-8195-bf31c0b1bbec/uploaded_image_0_1764667636249.png",
        "/home/rbremaud/.gemini/antigravity/brain/a6811d95-6569-4527-8195-bf31c0b1bbec/uploaded_image_1_1764667636249.png"
    ]
    
    output_dir = "/home/rbremaud/Sites/shifumi/public/avatars"
    
    avatar_count = 1
    
    for img_path in image_paths:
        try:
            img = Image.open(img_path)
            width, height = img.size
            
            # Assuming 2x2 grid
            cell_width = width // 2
            cell_height = height // 2
            
            for i in range(2): # rows
                for j in range(2): # cols
                    left = j * cell_width
                    upper = i * cell_height
                    right = left + cell_width
                    lower = upper + cell_height
                    
                    crop = img.crop((left, upper, right, lower))
                    
                    # Save as avatar_X.png
                    output_path = os.path.join(output_dir, f"avatar_{avatar_count}.png")
                    crop.save(output_path)
                    print(f"Saved {output_path}")
                    
                    avatar_count += 1
                    
        except Exception as e:
            print(f"Error processing {img_path}: {e}")

if __name__ == "__main__":
    split_avatars()
