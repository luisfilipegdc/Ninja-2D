#importando a biblioteca do PYGAME
from turtle import speed
from typing import KeysView
import pygame

#iniciando o PYGAME
pygame.init()
display = pygame.display.set_mode([640,480])
pygame.display.set_caption("Nija 2D Aula 01")

#imagens\Sprites
spriteGroup = pygame.sprite.Group()

pixil = pygame.sprite.Sprite(spriteGroup)
pixil.image = pygame.image.load("data/pixil0.png").convert_alpha()
pixil.image = pygame.transform.scale(pixil.image, [100,100])
pixil.rect = pixil.image.get_rect()

#objetos\objects
rect=pygame.Rect(0,200,100,100)
speed = 3

#sons\sounds
sound = pygame.mixer.Sound("data/pistol.wav")

sound.play()

clock=pygame.time.Clock()
gameloop = True
while gameloop:
    clock.tick(60)

    for event in pygame.event.get():
        if event.type ==pygame.QUIT:
            gameloop = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_e:
                rect[0]+= 100     

    keys = pygame.key.get_pressed()
    
    if keys[pygame.K_d]:
        pixil.rect [0] += speed
    if keys[pygame.K_a]:
        pixil.rect [0] -= speed
    if keys[pygame.K_s]:
        pixil.rect [1] += speed
    if keys[pygame.K_w]:
        pixil.rect [1] -= speed

    #Draw\Desenhos
    display.fill([25,25,25])

    pygame.draw.rect(display, [255,0,0], rect)

    spriteGroup.update()
    spriteGroup.draw(display)

    pygame.display.update()