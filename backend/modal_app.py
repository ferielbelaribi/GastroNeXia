import modal

app = modal.App("gastronexia-backend")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "libgl1",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
    )
    .pip_install(
        "fastapi",
        "uvicorn",
        "ultralytics",
        "torch",
        "torchvision",
        "grad-cam",
        "opencv-python-headless",
        "pillow",
        "python-multipart",
        "numpy",
        "scipy",
        "segmentation-models-pytorch",
        "albumentations",
    )
)

@app.function(
    image=image,
    memory=2048,
    timeout=300,
)
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/app")
    from main import app as fastapi_application
    return fastapi_application