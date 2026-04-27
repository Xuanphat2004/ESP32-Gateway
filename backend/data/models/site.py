from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()
test_user = User.objects.first() # Lấy user có id=1 (xuanphat)

class Site(models.Model):
    site_id = models.IntegerField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    location = models.CharField(max_length=255)
    site_name = models.CharField(max_length=255)

    class Meta:
        db_table = 'site'
        # managed = False
